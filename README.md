# Wimblebronx

Wimblebronx Tennis League application.

## Project Structure

- `frontend/`: Frontend application (HTML, CSS, JS).
- `backend/`: FastAPI backend application.
- `Dockerfile`: Configuration for containerizing the application.

## Firestore Setup

Firestore is a NoSQL document database. You don't need to create schemas upfront, but here is the structure used by the app:

### Collections

- **players**: Stores player profiles.
    - Document ID: Auto-generated or custom.
    - Fields:
        - `name`: String
        - `photo`: String (Base64 encoded, optional)
- **seasons**: Stores season details.
    - Document ID: Auto-generated.
    - Fields:
        - `name`: String
        - `startDate`: String (YYYY-MM-DD)
        - `endDate`: String (YYYY-MM-DD)
        - `winner`: String (Player name, optional)
        - `format`: Map
            - `type`: String ("firstto" or "bo")
            - `n`: Integer
        - `playerIds`: Array of Strings (Player IDs)
- **matches**: Stores match results.
    - Document ID: Auto-generated.
    - Fields:
        - `seasonId`: String
        - `date`: String (YYYY-MM-DD)
        - `teamA`: Array of Strings (Player IDs)
        - `teamB`: Array of Strings (Player IDs)
        - `gamesA`: Integer
        - `gamesB`: Integer
        - `winner`: String ("A" or "B")
        - `format`: Map (same as in seasons)
- **availability**: Stores daily player availability.
    - Document ID: Player ID.
    - Fields:
        - `available`: Boolean
- **locked_dates**: Stores dates when sessions are locked.
    - Document ID: Date string (YYYY-MM-DD).
    - Fields:
        - `date`: String (YYYY-MM-DD)
- **live_matches**: Stores currently ongoing live matches.
    - Document ID: Season ID.
    - Fields:
        - `live`: Map
            - `gamesA`: Integer
            - `gamesB`: Integer
            - `ptA`: Integer
            - `ptB`: Integer
            - `deuceRule`: String ("sudden" or "full")
            - `serve`: String ("a" or "b")
            - `history`: Array of Maps (scoring history)
            - `matchOver`: Boolean
        - `selA`: Array of Strings (Player IDs)
        - `selB`: Array of Strings (Player IDs)
        - `seasonId`: String

### Setup Commands

Run the following commands to set up the Firestore database:

```bash
# Enable Firestore API
gcloud services enable firestore.googleapis.com

# Create Firestore database
gcloud firestore databases create --location=YOUR_PREFERRED_LOCATION
```
*Replace `YOUR_PREFERRED_LOCATION` with a valid location like `nam5` (us-central) or `eur3` (europe-west).*

## Deployment

### Local Development

1.  **Backend**:
    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn app.main:app --reload
    ```
    *Note: You need to have Application Default Credentials set up for Firestore.*

2.  **Frontend**: Open `frontend/index.html` in a browser. If running the backend on a different port or host, you might need to update `API_URL` in `frontend/app.js`.

### Cloud Run Deployment

To deploy the application to Google Cloud Run using the source code directly:

```bash
gcloud run deploy wimblebronx --source . --allow-unauthenticated
```

This command will build the container image using Cloud Build and deploy it to Cloud Run, using the `Dockerfile` in the project root.
