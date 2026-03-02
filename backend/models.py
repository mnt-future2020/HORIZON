from pydantic import BaseModel
from typing import List, Optional


class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    role: str = "player"
    phone: Optional[str] = ""
    sports: Optional[List[str]] = []
    business_name: Optional[str] = ""
    gst_number: Optional[str] = ""
    coach_type: Optional[str] = ""  # "individual" or "academy"


class LoginInput(BaseModel):
    email: str
    password: str


class VenueCreate(BaseModel):
    name: str
    description: str
    sports: List[str]
    address: str
    area: Optional[str] = ""
    city: str
    lat: Optional[float] = 12.9716
    lng: Optional[float] = 77.5946
    amenities: Optional[List[str]] = []
    images: Optional[List[str]] = []
    base_price: int = 2000
    slot_duration_minutes: int = 60
    opening_hour: int = 6
    closing_hour: int = 23
    turfs: int = 1
    turf_config: Optional[List[dict]] = None
    # e.g. [{"sport": "football", "turfs": [{"name": "Main Ground"}, {"name": "Mini Pitch"}]}]


class VenueUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sports: Optional[List[str]] = None
    address: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    amenities: Optional[List[str]] = None
    images: Optional[List[str]] = None
    base_price: Optional[int] = None
    slot_duration_minutes: Optional[int] = None
    opening_hour: Optional[int] = None
    closing_hour: Optional[int] = None
    turfs: Optional[int] = None
    turf_config: Optional[List[dict]] = None


class BookingCreate(BaseModel):
    venue_id: str
    date: str
    start_time: str
    end_time: str
    turf_number: int = 1
    sport: str = "football"
    payment_mode: str = "full"
    split_count: Optional[int] = None
    num_players: Optional[int] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


class PricingRuleCreate(BaseModel):
    name: str
    is_active: bool = True
    # New fields
    rule_type: str = "discount"       # "discount" | "surge"
    value_type: str = "percent"       # "percent" | "amount"
    value: float = 0
    schedule_type: str = "recurring"  # "recurring" | "one_time"
    # Recurring schedule
    conditions: dict = {}             # {days:[0..6], time_range:{start,end}}
    # One-time schedule
    date_from: Optional[str] = None   # YYYY-MM-DD
    date_to: Optional[str] = None     # YYYY-MM-DD
    time_from: Optional[str] = None   # HH:MM
    time_to: Optional[str] = None     # HH:MM
    # Legacy (kept for backward compat)
    priority: int = 0
    action: dict = {}


class MatchRequestCreate(BaseModel):
    sport: str
    date: str
    time: str
    venue_name: Optional[str] = ""
    area: Optional[str] = ""
    city: Optional[str] = ""
    players_needed: int
    min_skill: Optional[int] = 0
    max_skill: Optional[int] = 3000
    description: Optional[str] = ""


class NotifySubscribeInput(BaseModel):
    venue_id: str
    date: str
    start_time: str
    turf_number: int = 1


class MercenaryCreate(BaseModel):
    booking_id: str
    position_needed: str
    amount_per_player: int
    spots_available: int = 1
    description: str = ""


class AcademyCreate(BaseModel):
    name: str
    sport: str
    description: str
    monthly_fee: int
    location: str
    max_students: int = 50
    schedule: str


# ─── Academy Management Models ────────────────────────────────────────────────

class AcademyEnroll(BaseModel):
    batch_id: Optional[str] = ""


class BatchCreate(BaseModel):
    name: str
    max_students: int = 30
    start_time: str          # "06:00"
    end_time: str            # "08:00"
    days: List[int] = []     # 0=Sun..6=Sat


class AttendanceMark(BaseModel):
    date: str                # "YYYY-MM-DD"
    batch_id: Optional[str] = ""
    present_student_ids: List[str]


class ProgressEntry(BaseModel):
    skill_ratings: dict = {}  # {"forehand": 7, "stamina": 8}
    assessment_type: str = "monthly"
    notes: str = ""


class FeeCollect(BaseModel):
    student_id: str
    amount: int
    payment_method: str = "cash"
    period_month: str         # "2026-02"
    notes: str = ""


class SlotLockInput(BaseModel):
    venue_id: str
    date: str
    start_time: str
    turf_number: int = 1


class MatchResultSubmit(BaseModel):
    team_a: List[str]
    team_b: List[str]
    winner: str  # "team_a", "team_b", "draw"
    score_a: Optional[int] = None
    score_b: Optional[int] = None


class SocialPostCreate(BaseModel):
    content: str = ""
    media_url: Optional[str] = ""
    venue_id: Optional[str] = ""
    match_id: Optional[str] = ""
    post_type: str = "text"  # text, highlight, photo, match_result


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    group_type: str = "community"  # community, club, team
    sport: str = ""
    avatar_url: Optional[str] = ""
    cover_url: Optional[str] = ""
    is_private: bool = False
    max_members: int = 500


class TeamCreate(BaseModel):
    name: str
    sport: str
    description: str = ""
    avatar_url: Optional[str] = ""
    max_players: int = 20
    skill_range_min: int = 0
    skill_range_max: int = 3000


class MessageCreate(BaseModel):
    content: str = ""
    media_url: Optional[str] = ""
    media_type: Optional[str] = ""  # image, document, audio, voice
    file_name: Optional[str] = ""
    duration: Optional[int] = None  # seconds, for voice/audio
    reply_to: Optional[str] = ""
    shared_post: Optional[dict] = None  # {id, user_name, content, media_url}


# ─── Organization & Performance Models ────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str
    org_type: str  # individual_coach, academy, school, college
    sports: List[str]
    description: str = ""
    location: str = ""
    city: str = ""
    logo_url: str = ""
    contact_email: str = ""
    contact_phone: str = ""


class PerformanceRecordCreate(BaseModel):
    player_id: str
    record_type: str  # match_result, training, assessment, tournament_result, achievement
    sport: str
    title: str
    stats: dict = {}
    notes: str = ""
    date: str  # YYYY-MM-DD


class TrainingLogCreate(BaseModel):
    title: str
    sport: str
    date: str
    duration_minutes: int = 60
    drills: List[str] = []
    player_ids: List[str] = []
    notes: str = ""
    performance_notes: dict = {}  # {player_id: "note"}


class BulkRecordCreate(BaseModel):
    player_ids: List[str]
    record_type: str
    sport: str
    title: str
    stats: dict = {}
    date: str


# ─── Live Scoring Models ─────────────────────────────────────────────────────

class LiveScoreStart(BaseModel):
    tournament_id: str
    match_id: str


class LiveScoreUpdate(BaseModel):
    team: str  # "home" or "away"
    delta: int = 1  # +1 or -1


class LiveScoreEvent(BaseModel):
    type: str  # goal, card, point, foul, timeout, ace, wicket, etc.
    team: str  # home or away
    player_name: str = ""
    minute: int = 0
    description: str = ""


class LivePeriodChange(BaseModel):
    period: int
    period_label: str = ""  # "2nd Half", "Set 3", etc.
