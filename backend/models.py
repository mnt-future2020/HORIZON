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
    priority: int = 0
    conditions: dict = {}
    action: dict = {}
    is_active: bool = True


class MatchRequestCreate(BaseModel):
    sport: str
    date: str
    time: str
    venue_name: Optional[str] = ""
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
    content: str
    media_url: Optional[str] = ""
    reply_to: Optional[str] = ""
