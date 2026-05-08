from fastapi import APIRouter, HTTPException
from typing import List, Dict
from app.database import db
from app.models import Player, PlayerLogin, PasswordChange
from passlib.hash import bcrypt

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
        data.pop('hashed_password', None)
        players.append(Player(**data))
    return players

@router.post("/", response_model=Player)
async def create_player(player: Player):
    doc_ref = db.collection('players').document()
    player_data = player.dict(exclude_unset=True)
    player_data.pop('id', None)
    if 'hashed_password' not in player_data or not player_data['hashed_password']:
        player_data['hashed_password'] = bcrypt.hash("root")
    doc_ref.set(player_data)
    player_data['id'] = doc_ref.id
    player_data.pop('hashed_password', None)
    return Player(**player_data)

@router.post("/login")
async def login(credentials: PlayerLogin):
    docs = db.collection('players').where('name', '==', credentials.name).limit(1).stream()
    player = None
    player_id = None
    for doc in docs:
        player = doc.to_dict()
        player_id = doc.id
        break
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    hashed_pw = player.get('hashed_password')
    
    if not hashed_pw:
        if credentials.password == "root":
            hashed_pw = bcrypt.hash("root")
            db.collection('players').document(player_id).update({'hashed_password': hashed_pw})
        else:
            raise HTTPException(status_code=401, detail="Invalid password")
    
    if not bcrypt.verify(credentials.password, hashed_pw):
        raise HTTPException(status_code=401, detail="Invalid password")
        
    return {"message": "Login successful", "player_id": player_id, "name": player['name']}

@router.put("/{player_id}/change-password")
async def change_password(player_id: str, cp: PasswordChange):
    doc_ref = db.collection('players').document(player_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Player not found")
    
    player_data = doc.to_dict()
    hashed_pw = player_data.get('hashed_password')
    
    if not hashed_pw:
        hashed_pw = bcrypt.hash("root")
        
    if not bcrypt.verify(cp.old_password, hashed_pw):
        raise HTTPException(status_code=401, detail="Invalid old password")
        
    new_hashed_pw = bcrypt.hash(cp.new_password)
    doc_ref.update({'hashed_password': new_hashed_pw})
    return {"message": "Password updated successfully"}

@router.put("/{player_id}", response_model=Player)
async def update_player(player_id: str, player: Player):
    doc_ref = db.collection('players').document(player_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Player not found")
    
    player_data = player.dict(exclude_unset=True)
    player_data.pop('id', None)
    player_data.pop('hashed_password', None)
    
    doc_ref.update(player_data)
    
    updated_doc = doc_ref.get()
    updated_data = updated_doc.to_dict()
    updated_data['id'] = updated_doc.id
    updated_data.pop('hashed_password', None)
    return Player(**updated_data)

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
