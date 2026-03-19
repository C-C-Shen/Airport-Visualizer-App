from pydantic import BaseModel
from typing import List, Optional

class Node(BaseModel):
    id: str
    x: float
    y: float

class Edge(BaseModel):
    id: str
    name: str  # "A", "B", "RWY23"
    type: str  # "taxiway" | "runway"
    from_node: str
    to_node: str

class Area(BaseModel):
    id: str
    type: str  # "apron"
    name: str  # "GA apron"
    node_ids: List[str]

class POI(BaseModel):
    id: str
    type: str  # "hold_short" | "runup"
    node_id: str
    runway: Optional[str] = None

class Airport(BaseModel):
    id: str
    nodes: List[Node]
    edges: List[Edge]
    areas: List[Area]
    pois: List[POI]