from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from tz import now_ist
from auth import get_current_user, get_razorpay_client, get_platform_settings
from models import (
    AcademyCreate, AcademyEnroll, BatchCreate,
    AttendanceMark, ProgressEntry, FeeCollect
)
import uuid
import hmac
import hashlib
import os
import math
import logging

logger = logging.getLogger("lobbi")
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

async def _require_academy_coach(academy_id: str, user: dict):
    """Assert the user is the coach of this academy (or super_admin)."""
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if not academy:
        raise HTTPException(404, "Academy not found")
    if user["role"] == "super_admin":
        return academy
    if academy.get("coach_id") != user["id"]:
        raise HTTPException(403, "Only the academy coach can manage this")
    return academy


# ═══════════════════════════════════════════════════════════════════════════════
# Core Academy CRUD (existing)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/academies")
async def list_academies(
    sport: Optional[str] = None,
    city: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    query = {"status": "active"}
    if sport:
        query["sport"] = sport
    if city:
        query["location"] = {"$regex": city, "$options": "i"}
    total = await db.academies.count_documents(query)
    skip = (page - 1) * limit
    academies = await db.academies.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(limit)
    # Add available slots
    for a in academies:
        a["available_slots"] = a.get("max_students", 50) - a.get("current_students", 0)
    return {"academies": academies, "total": total, "page": page, "pages": math.ceil(total / max(limit, 1))}


@router.post("/academies")
async def create_academy(input: AcademyCreate, user=Depends(get_current_user)):
    if user["role"] != "coach":
        raise HTTPException(403, "Only coaches can create academies")
    academy = {
        "id": str(uuid.uuid4()), "coach_id": user["id"],
        "coach_name": user["name"], **input.model_dump(),
        "current_students": 0, "students": [],
        "status": "active",
        "created_at": now_ist().isoformat()
    }
    await db.academies.insert_one(academy)
    academy.pop("_id", None)
    return academy


@router.get("/academies/{academy_id}")
async def get_academy(academy_id: str):
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if not academy:
        raise HTTPException(404, "Academy not found")
    return academy


@router.post("/academies/{academy_id}/students")
async def add_student(academy_id: str, request: Request, user=Depends(get_current_user)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy:
        raise HTTPException(404, "Academy not found")
    if academy.get("coach_id") != user["id"]:
        raise HTTPException(403, "Only the academy coach can manage students")
    body = await request.json()
    student = {
        "id": str(uuid.uuid4()),
        "name": body.get("name", ""),
        "email": body.get("email", ""),
        "phone": body.get("phone", ""),
        "joined_at": now_ist().isoformat(),
        "subscription_status": "active"
    }
    await db.academies.update_one(
        {"id": academy_id},
        {"$push": {"students": student}, "$inc": {"current_students": 1}}
    )
    return student


@router.delete("/academies/{academy_id}/students/{student_id}")
async def remove_student(academy_id: str, student_id: str, user=Depends(get_current_user)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy:
        raise HTTPException(404, "Academy not found")
    if academy.get("coach_id") != user["id"]:
        raise HTTPException(403, "Only the academy coach can manage students")
    students = [s for s in academy.get("students", []) if s["id"] != student_id]
    await db.academies.update_one(
        {"id": academy_id},
        {"$set": {"students": students, "current_students": len(students)}}
    )
    return {"message": "Student removed"}


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 1: Student Enrollment with Payment
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/academies/{academy_id}/enroll")
async def enroll_in_academy(academy_id: str, input: AcademyEnroll, user=Depends(get_current_user)):
    """Player self-enrolls in an academy with payment."""
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if not academy:
        raise HTTPException(404, "Academy not found")
    if academy.get("status") != "active":
        raise HTTPException(400, "Academy is not active")
    if academy.get("current_students", 0) >= academy.get("max_students", 50):
        raise HTTPException(400, "Academy is full")

    # Check for existing active enrollment
    existing = await db.academy_enrollments.find_one({
        "academy_id": academy_id, "student_id": user["id"],
        "status": {"$in": ["active", "payment_pending"]}
    })
    if existing:
        raise HTTPException(409, "You already have an active enrollment in this academy")

    platform = await get_platform_settings()
    commission_pct = platform.get("academy_commission_pct", 10)
    fee = academy["monthly_fee"]
    commission_amount = int(fee * commission_pct / 100)

    now = now_ist()
    enrollment = {
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "academy_name": academy["name"],
        "student_id": user["id"],
        "student_name": user.get("name", ""),
        "student_email": user.get("email", ""),
        "student_phone": user.get("phone", ""),
        "batch_id": input.batch_id or "",
        "monthly_fee": fee,
        "commission_amount": commission_amount,
        "current_period_start": now.isoformat(),
        "current_period_end": (now + timedelta(days=30)).isoformat(),
        "created_at": now.isoformat(),
    }

    rzp_client = await get_razorpay_client()
    if rzp_client:
        enrollment["status"] = "payment_pending"
        try:
            rzp_order = rzp_client.order.create({
                "amount": fee * 100,
                "currency": "INR",
                "payment_capture": 1,
                "notes": {"enrollment_id": enrollment["id"], "type": "academy_enrollment"}
            })
            enrollment["razorpay_order_id"] = rzp_order["id"]
            enrollment["payment_gateway"] = "razorpay"
        except Exception:
            raise HTTPException(502, "Payment gateway error. Please try again.")
    else:
        if os.environ.get("ENVIRONMENT") == "production":
            raise HTTPException(502, "Payment gateway not available.")
        enrollment["status"] = "payment_pending"
        enrollment["payment_gateway"] = "test"

    await db.academy_enrollments.insert_one(enrollment)
    enrollment.pop("_id", None)

    gw = platform.get("payment_gateway", {})
    enrollment["razorpay_key_id"] = gw.get("key_id", "")
    return enrollment


@router.post("/academies/{academy_id}/enroll/verify-payment")
async def verify_enrollment_payment(academy_id: str, request: Request, user=Depends(get_current_user)):
    """Verify Razorpay payment for academy enrollment."""
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id", "")
    razorpay_order_id = data.get("razorpay_order_id", "")
    razorpay_signature = data.get("razorpay_signature", "")

    enrollment = await db.academy_enrollments.find_one({
        "academy_id": academy_id, "student_id": user["id"], "status": "payment_pending"
    })
    if not enrollment:
        raise HTTPException(404, "Pending enrollment not found")

    settings = await get_platform_settings()
    gw = settings.get("payment_gateway", {})
    key_secret = gw.get("key_secret", "")
    if not key_secret:
        raise HTTPException(500, "Payment gateway not configured.")

    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(400, "Payment verification failed")

    now = now_ist()
    await db.academy_enrollments.update_one({"id": enrollment["id"]}, {"$set": {
        "status": "active",
        "payment_details": {
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "paid_at": now.isoformat()
        }
    }})

    # Increment student count
    await db.academies.update_one({"id": academy_id}, {"$inc": {"current_students": 1}})

    # First month fee record
    await db.academy_fee_records.insert_one({
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "student_id": user["id"],
        "student_name": user.get("name", ""),
        "amount": enrollment["monthly_fee"],
        "payment_method": "razorpay",
        "period_month": now.strftime("%Y-%m"),
        "status": "paid",
        "collected_by": "self",
        "notes": "Enrollment payment",
        "created_at": now.isoformat(),
    })

    # Notify coach
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if academy:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": academy["coach_id"],
            "type": "new_academy_enrollment",
            "title": "New Student Enrolled!",
            "message": f'{user.get("name", "A student")} enrolled in your "{academy["name"]}" academy.',
            "is_read": False,
            "created_at": now.isoformat(),
        })

    return {"message": "Payment verified, enrollment active", "status": "active"}


@router.post("/academies/{academy_id}/enroll/test-confirm")
async def test_confirm_enrollment(academy_id: str, user=Depends(get_current_user)):
    """Confirm enrollment for test-mode payments (dev only)."""
    if os.environ.get("ENVIRONMENT") == "production":
        raise HTTPException(403, "Test endpoints disabled in production")

    enrollment = await db.academy_enrollments.find_one({
        "academy_id": academy_id, "student_id": user["id"], "status": "payment_pending"
    })
    if not enrollment:
        raise HTTPException(404, "Pending enrollment not found")
    if enrollment.get("payment_gateway") not in ("test", "mock"):
        raise HTTPException(400, "Only for test-mode enrollments")

    now = now_ist()
    await db.academy_enrollments.update_one({"id": enrollment["id"]}, {"$set": {
        "status": "active",
        "payment_details": {
            "method": "test",
            "test_payment_id": f"test_{uuid.uuid4().hex[:12]}",
            "paid_at": now.isoformat()
        }
    }})

    await db.academies.update_one({"id": academy_id}, {"$inc": {"current_students": 1}})

    # First month fee record
    await db.academy_fee_records.insert_one({
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "student_id": user["id"],
        "student_name": user.get("name", ""),
        "amount": enrollment["monthly_fee"],
        "payment_method": "test",
        "period_month": now.strftime("%Y-%m"),
        "status": "paid",
        "collected_by": "self",
        "notes": "Test enrollment payment",
        "created_at": now.isoformat(),
    })

    # Notify coach
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    if academy:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": academy["coach_id"],
            "type": "new_academy_enrollment",
            "title": "New Student Enrolled!",
            "message": f'{user.get("name", "A student")} enrolled in your "{academy["name"]}" academy.',
            "is_read": False,
            "created_at": now.isoformat(),
        })

    return {"message": "Test enrollment confirmed", "status": "active"}


@router.get("/academies/{academy_id}/enrollments")
async def list_enrollments(
    academy_id: str,
    status: Optional[str] = None,
    user=Depends(get_current_user)
):
    """List all enrollments for an academy (coach only)."""
    await _require_academy_coach(academy_id, user)
    query = {"academy_id": academy_id}
    if status:
        query["status"] = status
    enrollments = await db.academy_enrollments.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(200)
    return enrollments


@router.put("/enrollments/{enrollment_id}/cancel")
async def cancel_enrollment(enrollment_id: str, user=Depends(get_current_user)):
    """Cancel an enrollment (student or coach)."""
    enrollment = await db.academy_enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(404, "Enrollment not found")

    # Either the student or the academy coach can cancel
    if enrollment["student_id"] != user["id"]:
        academy = await db.academies.find_one({"id": enrollment["academy_id"]}, {"_id": 0})
        if not academy or (academy.get("coach_id") != user["id"] and user["role"] != "super_admin"):
            raise HTTPException(403, "Not authorized to cancel this enrollment")

    if enrollment.get("status") not in ("active", "payment_pending"):
        raise HTTPException(400, f"Enrollment is already {enrollment.get('status')}")

    now = now_ist()
    was_active = enrollment.get("status") == "active"

    await db.academy_enrollments.update_one({"id": enrollment_id}, {"$set": {
        "status": "cancelled",
        "cancelled_at": now.isoformat()
    }})

    if was_active:
        await db.academies.update_one(
            {"id": enrollment["academy_id"]},
            {"$inc": {"current_students": -1}}
        )

    return {"message": "Enrollment cancelled"}


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2: Batch Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/academies/{academy_id}/batches")
async def create_batch(academy_id: str, input: BatchCreate, user=Depends(get_current_user)):
    """Create a new batch for an academy (coach only)."""
    await _require_academy_coach(academy_id, user)
    batch = {
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "name": input.name,
        "max_students": input.max_students,
        "current_students": 0,
        "start_time": input.start_time,
        "end_time": input.end_time,
        "days": input.days,
        "student_ids": [],
        "status": "active",
        "created_at": now_ist().isoformat(),
    }
    await db.academy_batches.insert_one(batch)
    batch.pop("_id", None)
    return batch


@router.get("/academies/{academy_id}/batches")
async def list_batches(academy_id: str, user=Depends(get_current_user)):
    """List batches for an academy."""
    batches = await db.academy_batches.find(
        {"academy_id": academy_id, "status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return batches


@router.put("/batches/{batch_id}")
async def update_batch(batch_id: str, request: Request, user=Depends(get_current_user)):
    """Update a batch (coach only)."""
    batch = await db.academy_batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(404, "Batch not found")
    await _require_academy_coach(batch["academy_id"], user)

    body = await request.json()
    allowed = {"name", "max_students", "start_time", "end_time", "days", "status"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if updates:
        await db.academy_batches.update_one({"id": batch_id}, {"$set": updates})
    return {"message": "Batch updated"}


@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str, user=Depends(get_current_user)):
    """Soft-delete a batch (coach only)."""
    batch = await db.academy_batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(404, "Batch not found")
    await _require_academy_coach(batch["academy_id"], user)
    await db.academy_batches.update_one({"id": batch_id}, {"$set": {"status": "inactive"}})
    return {"message": "Batch deactivated"}


@router.post("/batches/{batch_id}/assign")
async def assign_student_to_batch(batch_id: str, request: Request, user=Depends(get_current_user)):
    """Assign a student to a batch (coach only)."""
    batch = await db.academy_batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(404, "Batch not found")
    await _require_academy_coach(batch["academy_id"], user)

    body = await request.json()
    student_id = body.get("student_id", "")
    if not student_id:
        raise HTTPException(400, "student_id required")

    # Verify student has active enrollment
    enrollment = await db.academy_enrollments.find_one({
        "academy_id": batch["academy_id"], "student_id": student_id, "status": "active"
    })
    if not enrollment:
        raise HTTPException(400, "Student does not have an active enrollment in this academy")

    if batch.get("current_students", 0) >= batch.get("max_students", 30):
        raise HTTPException(400, "Batch is full")

    if student_id in batch.get("student_ids", []):
        raise HTTPException(409, "Student already in this batch")

    await db.academy_batches.update_one({"id": batch_id}, {
        "$addToSet": {"student_ids": student_id},
        "$inc": {"current_students": 1}
    })
    await db.academy_enrollments.update_one({"id": enrollment["id"]}, {
        "$set": {"batch_id": batch_id}
    })
    return {"message": "Student assigned to batch"}


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3: Attendance Tracking
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/academies/{academy_id}/attendance")
async def mark_attendance(academy_id: str, input: AttendanceMark, user=Depends(get_current_user)):
    """Mark attendance for a date (bulk). Upserts on (academy_id, date, batch_id)."""
    await _require_academy_coach(academy_id, user)

    # Get all enrolled students (or batch students)
    if input.batch_id:
        batch = await db.academy_batches.find_one({"id": input.batch_id}, {"_id": 0})
        all_student_ids = batch.get("student_ids", []) if batch else []
    else:
        enrollments = await db.academy_enrollments.find(
            {"academy_id": academy_id, "status": "active"}, {"student_id": 1, "_id": 0}
        ).to_list(500)
        all_student_ids = [e["student_id"] for e in enrollments]

    present_set = set(input.present_student_ids)
    absent = [sid for sid in all_student_ids if sid not in present_set]

    now = now_ist()
    record = {
        "academy_id": academy_id,
        "batch_id": input.batch_id or "",
        "date": input.date,
        "present": input.present_student_ids,
        "absent": absent,
        "total_students": len(all_student_ids),
        "present_count": len(input.present_student_ids),
        "marked_by": user["id"],
        "updated_at": now.isoformat(),
    }

    # Upsert — allow corrections
    existing = await db.academy_attendance.find_one({
        "academy_id": academy_id, "date": input.date, "batch_id": input.batch_id or ""
    })
    if existing:
        await db.academy_attendance.update_one({"id": existing["id"]}, {"$set": record})
        record["id"] = existing["id"]
    else:
        record["id"] = str(uuid.uuid4())
        record["created_at"] = now.isoformat()
        await db.academy_attendance.insert_one(record)

    record.pop("_id", None)
    return record


@router.get("/academies/{academy_id}/attendance")
async def get_attendance(
    academy_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    batch_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Get attendance records for an academy."""
    await _require_academy_coach(academy_id, user)
    query = {"academy_id": academy_id}
    if batch_id:
        query["batch_id"] = batch_id
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q["$gte"] = from_date
        if to_date:
            date_q["$lte"] = to_date
        query["date"] = date_q

    records = await db.academy_attendance.find(query, {"_id": 0}).sort(
        "date", -1
    ).to_list(100)
    return records


@router.get("/academies/{academy_id}/attendance/stats")
async def attendance_stats(academy_id: str, user=Depends(get_current_user)):
    """Per-student attendance stats (percentage, streak, total)."""
    await _require_academy_coach(academy_id, user)

    # Get all attendance records (last 90 days)
    cutoff = (now_ist() - timedelta(days=90)).strftime("%Y-%m-%d")
    records = await db.academy_attendance.find(
        {"academy_id": academy_id, "date": {"$gte": cutoff}}, {"_id": 0}
    ).sort("date", 1).to_list(500)

    # Get active enrollments
    enrollments = await db.academy_enrollments.find(
        {"academy_id": academy_id, "status": "active"}, {"_id": 0}
    ).to_list(500)

    student_stats = {}
    for e in enrollments:
        student_stats[e["student_id"]] = {
            "student_id": e["student_id"],
            "student_name": e.get("student_name", ""),
            "total_sessions": 0,
            "present_count": 0,
            "percentage": 0,
            "current_streak": 0,
        }

    # Calculate stats
    for rec in records:
        for sid in rec.get("present", []):
            if sid in student_stats:
                student_stats[sid]["total_sessions"] += 1
                student_stats[sid]["present_count"] += 1
        for sid in rec.get("absent", []):
            if sid in student_stats:
                student_stats[sid]["total_sessions"] += 1

    # Calculate percentages and streaks
    for sid, stats in student_stats.items():
        if stats["total_sessions"] > 0:
            stats["percentage"] = round(stats["present_count"] / stats["total_sessions"] * 100, 1)

        # Calculate current streak (consecutive present from latest)
        streak = 0
        for rec in reversed(records):
            if sid in rec.get("present", []):
                streak += 1
            elif sid in rec.get("absent", []):
                break
        stats["current_streak"] = streak

    # Academy-wide average
    all_pcts = [s["percentage"] for s in student_stats.values() if s["total_sessions"] > 0]
    avg_rate = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0

    return {
        "students": list(student_stats.values()),
        "academy_average": avg_rate,
        "total_sessions_tracked": len(records),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4: Fee Payment Tracking
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/academies/{academy_id}/fees")
async def get_fee_status(academy_id: str, user=Depends(get_current_user)):
    """Fee status for all active students: paid, pending, or overdue."""
    await _require_academy_coach(academy_id, user)

    current_month = now_ist().strftime("%Y-%m")
    enrollments = await db.academy_enrollments.find(
        {"academy_id": academy_id, "status": "active"}, {"_id": 0}
    ).to_list(500)

    # Bulk fetch fee records for current month
    student_ids = [e["student_id"] for e in enrollments]
    fee_records = await db.academy_fee_records.find({
        "academy_id": academy_id,
        "period_month": current_month,
        "student_id": {"$in": student_ids},
        "status": "paid"
    }, {"_id": 0}).to_list(500)

    paid_set = {r["student_id"] for r in fee_records}

    result = []
    for e in enrollments:
        sid = e["student_id"]
        if sid in paid_set:
            status = "paid"
            rec = next((r for r in fee_records if r["student_id"] == sid), None)
            paid_at = rec.get("created_at", "") if rec else ""
        else:
            # Check if overdue (past period end)
            period_end = e.get("current_period_end", "")
            if period_end and period_end < now_ist().isoformat():
                status = "overdue"
            else:
                status = "pending"
            paid_at = ""

        result.append({
            "student_id": sid,
            "student_name": e.get("student_name", ""),
            "enrollment_id": e["id"],
            "monthly_fee": e.get("monthly_fee", 0),
            "period_month": current_month,
            "status": status,
            "paid_at": paid_at,
        })

    return result


@router.post("/academies/{academy_id}/fees/collect")
async def collect_fee(academy_id: str, input: FeeCollect, user=Depends(get_current_user)):
    """Manually collect a fee (cash/UPI) for a student."""
    await _require_academy_coach(academy_id, user)

    # Verify enrollment
    enrollment = await db.academy_enrollments.find_one({
        "academy_id": academy_id, "student_id": input.student_id, "status": "active"
    })
    if not enrollment:
        raise HTTPException(400, "Student does not have an active enrollment")

    # Check for duplicate payment
    existing = await db.academy_fee_records.find_one({
        "academy_id": academy_id,
        "student_id": input.student_id,
        "period_month": input.period_month,
        "status": "paid"
    })
    if existing:
        raise HTTPException(409, f"Fee already collected for {input.period_month}")

    now = now_ist()
    record = {
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "student_id": input.student_id,
        "student_name": enrollment.get("student_name", ""),
        "amount": input.amount,
        "payment_method": input.payment_method,
        "period_month": input.period_month,
        "status": "paid",
        "collected_by": user["id"],
        "notes": input.notes,
        "created_at": now.isoformat(),
    }
    await db.academy_fee_records.insert_one(record)
    record.pop("_id", None)

    # Extend enrollment period
    await db.academy_enrollments.update_one({"id": enrollment["id"]}, {"$set": {
        "current_period_end": (now + timedelta(days=30)).isoformat()
    }})

    return record


@router.get("/academies/{academy_id}/fees/report")
async def fee_report(
    academy_id: str,
    month: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Monthly fee collection report."""
    await _require_academy_coach(academy_id, user)

    target_month = month or now_ist().strftime("%Y-%m")
    records = await db.academy_fee_records.find(
        {"academy_id": academy_id, "period_month": target_month, "status": "paid"}, {"_id": 0}
    ).to_list(500)

    total_collected = sum(r.get("amount", 0) for r in records)
    by_method = {}
    for r in records:
        m = r.get("payment_method", "unknown")
        by_method[m] = by_method.get(m, 0) + r.get("amount", 0)

    # Active enrollments count for expected total
    active_count = await db.academy_enrollments.count_documents({
        "academy_id": academy_id, "status": "active"
    })
    academy = await db.academies.find_one({"id": academy_id}, {"_id": 0})
    monthly_fee = academy.get("monthly_fee", 0) if academy else 0
    expected_total = active_count * monthly_fee
    pending_amount = max(0, expected_total - total_collected)

    platform = await get_platform_settings()
    commission_pct = platform.get("academy_commission_pct", 10)
    commission_owed = int(total_collected * commission_pct / 100)

    return {
        "month": target_month,
        "total_collected": total_collected,
        "expected_total": expected_total,
        "pending_amount": pending_amount,
        "paid_count": len(records),
        "active_students": active_count,
        "by_method": by_method,
        "commission_pct": commission_pct,
        "commission_owed": commission_owed,
        "records": records,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 5: Progress Tracking
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/academies/{academy_id}/students/{student_id}/progress")
async def add_progress(
    academy_id: str, student_id: str,
    input: ProgressEntry, user=Depends(get_current_user)
):
    """Add a progress/assessment entry for a student (coach only)."""
    await _require_academy_coach(academy_id, user)

    enrollment = await db.academy_enrollments.find_one({
        "academy_id": academy_id, "student_id": student_id, "status": "active"
    })
    if not enrollment:
        raise HTTPException(400, "Student not enrolled in this academy")

    now = now_ist()
    entry = {
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "student_id": student_id,
        "student_name": enrollment.get("student_name", ""),
        "coach_id": user["id"],
        "skill_ratings": input.skill_ratings,
        "assessment_type": input.assessment_type,
        "notes": input.notes,
        "date": now.strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
    }
    await db.academy_progress.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.get("/academies/{academy_id}/students/{student_id}/progress")
async def get_student_progress(
    academy_id: str, student_id: str, user=Depends(get_current_user)
):
    """Get progress history for a student (coach or the student)."""
    # Coach or the student themselves can view
    if user["id"] != student_id:
        await _require_academy_coach(academy_id, user)

    entries = await db.academy_progress.find(
        {"academy_id": academy_id, "student_id": student_id}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    return entries


@router.get("/academies/{academy_id}/progress/report")
async def progress_report(academy_id: str, user=Depends(get_current_user)):
    """Academy-wide progress report — average skill ratings across all students."""
    await _require_academy_coach(academy_id, user)

    entries = await db.academy_progress.find(
        {"academy_id": academy_id}, {"_id": 0}
    ).sort("date", -1).to_list(1000)

    if not entries:
        return {"students": [], "average_skills": {}, "total_assessments": 0}

    # Latest assessment per student
    latest_by_student = {}
    for e in entries:
        sid = e["student_id"]
        if sid not in latest_by_student:
            latest_by_student[sid] = e

    # Average skill ratings
    all_skills = {}
    skill_counts = {}
    for e in latest_by_student.values():
        for skill, val in e.get("skill_ratings", {}).items():
            all_skills[skill] = all_skills.get(skill, 0) + val
            skill_counts[skill] = skill_counts.get(skill, 0) + 1

    avg_skills = {k: round(v / skill_counts[k], 1) for k, v in all_skills.items()}

    return {
        "students": list(latest_by_student.values()),
        "average_skills": avg_skills,
        "total_assessments": len(entries),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 6: Academy Dashboard Stats
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/academies/{academy_id}/dashboard")
async def academy_dashboard(academy_id: str, user=Depends(get_current_user)):
    """Aggregated stats for academy overview."""
    academy = await _require_academy_coach(academy_id, user)

    current_month = now_ist().strftime("%Y-%m")
    cutoff_30d = (now_ist() - timedelta(days=30)).strftime("%Y-%m-%d")

    # Parallel counts
    active_enrollments = await db.academy_enrollments.count_documents({
        "academy_id": academy_id, "status": "active"
    })
    batch_count = await db.academy_batches.count_documents({
        "academy_id": academy_id, "status": "active"
    })

    # Monthly revenue
    month_fees = await db.academy_fee_records.find(
        {"academy_id": academy_id, "period_month": current_month, "status": "paid"}, {"_id": 0}
    ).to_list(500)
    monthly_revenue = sum(r.get("amount", 0) for r in month_fees)

    # Total revenue (all time)
    all_fees = await db.academy_fee_records.find(
        {"academy_id": academy_id, "status": "paid"}, {"amount": 1, "_id": 0}
    ).to_list(5000)
    total_revenue = sum(r.get("amount", 0) for r in all_fees)

    # Commission
    platform = await get_platform_settings()
    commission_pct = platform.get("academy_commission_pct", 10)
    commission_owed = int(total_revenue * commission_pct / 100)

    # Attendance rate (last 30 days)
    att_records = await db.academy_attendance.find(
        {"academy_id": academy_id, "date": {"$gte": cutoff_30d}}, {"_id": 0}
    ).to_list(200)
    total_present = sum(r.get("present_count", 0) for r in att_records)
    total_expected = sum(r.get("total_students", 0) for r in att_records)
    attendance_rate = round(total_present / total_expected * 100, 1) if total_expected > 0 else 0

    # Batch fill rates
    batches = await db.academy_batches.find(
        {"academy_id": academy_id, "status": "active"}, {"_id": 0}
    ).to_list(50)
    batch_fill = [{
        "name": b["name"],
        "current": b.get("current_students", 0),
        "max": b.get("max_students", 30),
        "percentage": round(b.get("current_students", 0) / max(b.get("max_students", 30), 1) * 100, 1),
    } for b in batches]

    # Overdue fees
    enrollments = await db.academy_enrollments.find(
        {"academy_id": academy_id, "status": "active"}, {"_id": 0}
    ).to_list(500)
    paid_ids = {r["student_id"] for r in month_fees}
    overdue_count = sum(1 for e in enrollments if e["student_id"] not in paid_ids)

    # Recent enrollments
    recent = await db.academy_enrollments.find(
        {"academy_id": academy_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "total_students": academy.get("current_students", 0),
        "max_students": academy.get("max_students", 50),
        "active_enrollments": active_enrollments,
        "monthly_revenue": monthly_revenue,
        "total_revenue": total_revenue,
        "commission_owed": commission_owed,
        "attendance_rate": attendance_rate,
        "batch_count": batch_count,
        "batch_fill_rates": batch_fill,
        "overdue_fees": overdue_count,
        "recent_enrollments": recent,
    }
