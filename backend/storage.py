import json
import os
import base64
from models import Airport

DATA_DIR = "data"

def save_airport(airport: Airport):
    folder = f"{DATA_DIR}/{airport.id}"
    os.makedirs(folder, exist_ok=True)
    
    # Process charts: Save images to disk and remove strings from JSON
    for chart in airport.charts:
        if chart.imageData and "," in chart.imageData:
            # Extract the actual base64 part
            header, encoded = chart.imageData.split(",", 1)
            data = base64.b64decode(encoded)
            
            # Save the binary file
            file_path = f"{folder}/{chart.id}.png"
            with open(file_path, "wb") as f:
                f.write(data)
            
            # Crucial: Remove the heavy string before saving the JSON
            # and keep the local path/URL reference
            chart.imageData = f"/charts/{airport.id}/{chart.id}.png"

    # Save the cleaned metadata to JSON
    path = f"{folder}/{airport.id}.json"
    with open(path, "w") as f:
        json.dump(airport.dict(), f, indent=2)

def load_airport(airport_id: str):
    folder = f"{DATA_DIR}/{airport_id}"
    path = f"{folder}/{airport_id}.json"
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)