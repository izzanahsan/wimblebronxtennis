from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import players, seasons, matches

app = FastAPI(title="Wimblebronx API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(players.router)
app.include_router(seasons.router)
app.include_router(matches.router)

# Serve static files
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
