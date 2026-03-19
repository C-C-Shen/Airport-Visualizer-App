from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from storage import save_airport, load_airport
from core.pipeline import get_node_path

from models import Airport

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/airport")
def save(data: Airport):
    print()
    save_airport(data)
    return {"status": "ok"}

@app.get("/airport/{airport_id}")
def load(airport_id: str):
    return load_airport(airport_id)

@app.get("/airport/{airport_id}/all_paths")
def load(airport_id: str):
    # return_path = get_node_path(load_airport(airport_id), ["apron", "B", "E", "06"])
    return_path = get_node_path(load_airport(airport_id), ["apron", "A", "08"])
    print(f"Paths: {return_path}")
    return return_path