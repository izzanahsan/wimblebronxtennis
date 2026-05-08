from google.cloud import firestore

# Initialize Firestore client.
# It will use Application Default Credentials (ADC) automatically.
db = firestore.Client()
