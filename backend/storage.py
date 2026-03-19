import json
import os
from models import Airport

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

def save_airport(airport: Airport):
    path = f"{DATA_DIR}/{airport.id}.json"
    with open(path, "w") as f:
        json.dump(airport.dict(), f, indent=2)

def load_airport(airport_id: str):
    path = f"{DATA_DIR}/{airport_id}.json"
    with open(path, "r") as f:
        return json.load(f)