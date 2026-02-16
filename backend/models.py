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


class LoginInput(BaseModel):
    email: str
    password: str


class VenueCreate(BaseModel):
    name: str
    description: str
    sports: List[str]
    address: str
    city: str
    base_price: int
    slot_duration_minutes: int = 60
    opening_hour: int = 6
    closing_hour: int = 23
    turfs: int = 1
    amenities: List[str] = []
    images: List[str] = []


class BookingCreate(BaseModel):
    venue_id: str
    date: str
    start_time: str
    end_time: str
    turf_number: int = 1
    sport: str = "football"
    payment_mode: str = "full"
    split_count: Optional[int] = None


class PricingRuleCreate(BaseModel):
    name: str
    priority: int = 10
    conditions: dict = {}
    action: dict = {}


class MatchRequestCreate(BaseModel):
    sport: str
    date: str
    time: str
    venue_name: str
    players_needed: int
    min_skill: int = 0
    max_skill: int = 3000
    description: str = ""


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


class SlotLockInput(BaseModel):
    venue_id: str
    date: str
    start_time: str
    turf_number: int = 1
