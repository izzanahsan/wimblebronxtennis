from fastapi import APIRouter, HTTPException
from typing import List, Dict
from app.database import db
from app.models import Player

router = APIRouter(
    prefix="/players",
    tags=["players"],
)

@router.get("/", response_model=List[Player])
async def get_players():
    players = []
    docs = db.collection('players').stream()
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        players.append(Player(**data))
    return players

@router.post("/", response_model=Player)
async def create_player(player: Player):
    doc_ref = db.collection('players').document()
    player_data = player.dict(exclude_unset=True)
    player_data.pop('id', None)
    doc_ref.set(player_data)
    return Player(id=doc_ref.id, **player.dict(exclude_unset=True))

@router.put("/{player_id}", response_model=Player)
async def update_player(player_id: str, player: Player):
    doc_ref = db.collection('players').document(player_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Player not found")
    
    player_data = player.dict(exclude_unset=True)
    player_data.pop('id', None)
    doc_ref.update(player_data)
    
    updated_doc = doc_ref.get()
    return Player(id=updated_doc.id, **updated_doc.to_dict())

@router.delete("/{player_id}")
async def delete_player(player_id: str):
    db.collection('players').document(player_id).delete()
    return {"message": "Player deleted"}

@router.get("/availability")
async def get_availability():
    avail = {}
    docs = db.collection('availability').stream()
    for doc in docs:
        avail[doc.id] = doc.to_dict().get('available', True)
    return avail

@router.put("/availability/{player_id}")
async def update_availability(player_id: str, available: bool):
    db.collection('availability').document(player_id).set({'available': available}, merge=True)
    return {"player_id": player_id, "available": available}
