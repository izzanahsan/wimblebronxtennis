from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.database import db
from app.models import Match

router = APIRouter(
    prefix="/matches",
    tags=["matches"],
)

@router.get("/", response_model=List[Match])
async def get_matches(season_id: Optional[str] = None):
    matches = []
    query = db.collection('matches')
    
    if season_id:
        query = query.where('season_id', '==', season_id)
        
    docs = query.stream()
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        matches.append(Match(**data))
    return matches

@router.post("/", response_model=Match)
async def create_match(match: Match):
    doc_ref = db.collection('matches').document()
    match_data = match.dict(exclude_unset=True)
    match_data.pop('id', None)
    doc_ref.set(match_data)
    return Match(id=doc_ref.id, **match.dict(exclude_unset=True))

@router.delete("/{match_id}")
async def delete_match(match_id: str):
    db.collection('matches').document(match_id).delete()
    return {"message": "Match deleted"}

@router.get("/locked-dates", response_model=List[str])
async def get_locked_dates():
    docs = db.collection('locked_dates').stream()
    return [doc.to_dict().get('date') for doc in docs]

@router.post("/locked-dates/{date}")
async def lock_date(date: str):
    db.collection('locked_dates').document(date).set({'date': date})
    return {"message": f"Date {date} locked"}

@router.delete("/locked-dates/{date}")
async def unlock_date(date: str):
    db.collection('locked_dates').document(date).delete()
    return {"message": f"Date {date} unlocked"}
