from typing import List, Optional
from pydantic import BaseModel

def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])

class CamelModel(BaseModel):
    class Config:
        alias_generator = to_camel
        populate_by_name = True

class Format(CamelModel):
    type: str
    n: int

class Player(CamelModel):
    id: Optional[str] = None
    name: str
    photo: Optional[str] = None
    hashed_password: Optional[str] = None
    about: Optional[str] = None

class PlayerLogin(CamelModel):
    name: str
    password: str

class PasswordChange(CamelModel):
    old_password: str
    new_password: str

class Season(CamelModel):
    id: Optional[str] = None
    name: str
    start_date: str
    end_date: str
    winner: Optional[str] = None
    format: Format
    player_ids: List[str] = []

class Match(CamelModel):
    id: Optional[str] = None
    season_id: str
    date: str
    team_a: List[str]
    team_b: List[str]
    games_a: int
    games_b: int
    winner: str
    format: Format

class Availability(CamelModel):
    player_id: str
    available: bool
