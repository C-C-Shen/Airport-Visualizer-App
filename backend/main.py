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
    # CYOW tests ALL
    test_paths = {
        "CYOW": {
            "DASH PORT 5110": {"assigned_path": ["apron", "B", "25"]},
            "DASH PORT 5619": {"assigned_path": ["apron", "A", "E", "32"]},
            "JAZZ 1027": {"assigned_path": ["07", "C", "A", "apron"]},
            "CGYWN": {"assigned_path": ["22", "P", "apron_general_aviation"]},
        },
        "CYTZ": {
            "JAZZ 3010": {"assigned_path": ["apron", "C", "D", "26"]},
            "DASH PORT 2331": {"assigned_path": ["08", "E", "B", "apron"]},
            "JAZZ 2917": {"assigned_path": ["08", "F", "apron"]},
            "CGMNQ": {"assigned_path": ["apron", "C", "D", "24"]},
        },
    }

    callsigns = test_paths[airport_id]

    for c in callsigns:
        node_path = get_node_path(load_airport(airport_id), callsigns[c]["assigned_path"])
        if isinstance(node_path, list):
            callsigns[c]["node_path"] = node_path
        else:
            print(f"Got error on {c} {node_path}")
            callsigns[c]["node_path"] = []
            
    return callsigns