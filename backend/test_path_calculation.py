from storage import load_airport
from core.pipeline import get_node_path

def fake_transcript():
    return "JAZZ seven-eight-six-four, GROUND, runway two-six, winds three-zero-zero at twenty-two, gusting thirty-one, altimeter three-zero-zero-five. Taxi Charlie Delta, contact TOWER one-one-eight decimal two, holding short, runway two-six."

def build_adjacency(graph_json):
    adj = {}

    for edge in graph_json["edges"]:
        a = edge["from_node"]
        b = edge["to_node"]

        # forward direction
        adj.setdefault(a, []).append({
            "to": b,
            "name": edge["name"],
            "type": edge["type"]
        })

        # reverse direction (VERY IMPORTANT for taxiing)
        adj.setdefault(b, []).append({
            "to": a,
            "name": edge["name"],
            "type": edge["type"]
        })

    return adj

airport_data = load_airport("CYTZ")
graph = build_adjacency(airport_data)
path_results = get_node_path(airport_data, ["apron", "C", "D", "26"])
print(f"final path: {path_results['node_path']}")

path_results = get_node_path(airport_data, ["26", "D", "24"])
print(f"final path: {path_results['node_path']}")

path_results = get_node_path(airport_data, ["apron", "A", "08"])
print(f"final path: {path_results['node_path']}")


path_results = get_node_path(airport_data, ["apron", "B", "E", "06"])
print(f"final path: {path_results['node_path']}")

