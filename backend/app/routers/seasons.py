from fastapi import APIRouter, HTTPException
from typing import List
from app.database import db
from app.models import Season
from google.cloud.firestore import ArrayUnion, ArrayRemove

router = APIRouter(
    prefix="/seasons",
    tags=["seasons"],
)

@router.get("/", response_model=List[Season])
async def get_seasons():
    seasons = []
    docs = db.collection('seasons').stream()
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        seasons.append(Season(**data))
    return seasons

@router.post("/", response_model=Season)
async def create_season(season: Season):
    doc_ref = db.collection('seasons').document()
    season_data = season.dict(exclude_unset=True)
    season_data.pop('id', None)
    doc_ref.set(season_data)
    return Season(id=doc_ref.id, **season.dict(exclude_unset=True))

@router.put("/{season_id}", response_model=Season)
async def update_season(season_id: str, season: Season):
    doc_ref = db.collection('seasons').document(season_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Season not found")
    
    season_data = season.dict(exclude_unset=True)
    season_data.pop('id', None)
    doc_ref.update(season_data)
    
    updated_doc = doc_ref.get()
    return Season(id=updated_doc.id, **updated_doc.to_dict())

@router.delete("/{season_id}")
async def delete_season(season_id: str):
    db.collection('seasons').document(season_id).delete()
    
    # Delete associated matches
    matches_ref = db.collection('matches').where('season_id', '==', season_id).stream()
    for match in matches_ref:
        match.reference.delete()
        
    return {"message": "Season and associated matches deleted"}

@router.post("/{season_id}/players/{player_id}")
async def add_player_to_season(season_id: str, player_id: str):
    doc_ref = db.collection('seasons').document(season_id)
    doc_ref.update({'player_ids': ArrayUnion([player_id])})
    return {"message": "Player added to season"}

@router.delete("/{season_id}/players/{player_id}")
async def remove_player_from_season(season_id: str, player_id: str):
    doc_ref = db.collection('seasons').document(season_id)
    doc_ref.update({'player_ids': ArrayRemove([player_id])})
    return {"message": "Player removed from season"}
