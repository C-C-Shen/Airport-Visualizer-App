# file is used for Sequential Multi‑Modal Pathfinding
# ie, given a set path labels like ["aprong", "A", "B", "26"], path must return nodes that have the shortest path that adhears to those labels and order

from collections import deque, defaultdict

# check if any elements in the lsits overlap
def check_list_contains(list1, list2):
    if any(item in list1 for item in list2):
        return True
    return False

def expand_on_current(path, available_edges, end_node):
    while True:
        previous = path[-1]

        connecting = []
        direct_to_end = []

        for e in available_edges:
            next_nodes = [e["from_node"], e["to_node"]]

            # connects to current path?
            if check_list_contains(previous["nodes"], next_nodes):
                connecting.append(e)

                # also touches the end_node?
                if check_list_contains(end_node["nodes"], next_nodes):
                    direct_to_end.append(e)

        # if any edge reaches the end_node, use it and finish
        if direct_to_end:
            best = direct_to_end[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            available_edges.remove(best)
            path.append(end_node)
            return path

        # if we can still move forward, take one step and loop again
        if connecting:
            best = connecting[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            available_edges.remove(best)
            # loop continues, trying to get closer to end_node
            continue

        # no way to expand and we never hit end_node
        return False
    
def build_graph(edges):
    graph = defaultdict(list)
    for e in edges:
        graph[e["from_node"]].append({"to": e["to_node"], "name": e["name"]})
        graph[e["to_node"]].append({"to": e["from_node"], "name": e["name"]})
    return graph

def build_area_lookup(areas):
    node_to_areas = defaultdict(list)
    area_map = {}

    for area in areas:
        nodes = set(area["node_ids"])
        area_map[area["name"]] = nodes
        for n in nodes:
            node_to_areas[n].append(area["name"])

    return area_map, node_to_areas

def get_start_nodes(airport_data, start_name):
    if "apron" in start_name.lower():
        for area in airport_data["areas"]:
            if area["name"] == start_name:
                return set(area["node_ids"])
    else:
        nodes = set()
        for e in airport_data["edges"]:
            if ("/" in e["name"] and start_name in e["name"]) or (start_name == e["name"]):
                nodes.add(e["from_node"])
                nodes.add(e["to_node"])
        return nodes
    return set()

def compare_name(edge_name, target):
    if "/" in edge_name:
        return target in edge_name.split("/")
    if "/" in target:
        return edge_name in target.split("/")
    return edge_name == target

def find_path(airport_data, start, end, path_names):
    edges = airport_data["edges"]
    areas = airport_data["areas"]

    graph = build_graph(edges)
    area_map, node_to_areas = build_area_lookup(areas)

    start_nodes = get_start_nodes(airport_data, start)
    end_nodes = get_start_nodes(airport_data, end)

    if not start_nodes or not end_nodes:
        return "INVALID START / END"

    queue = deque()

    # (node, idx, path)
    for n in start_nodes:
        queue.append((n, 1, [{"name": start, "nodes": [n]}]))

    visited = set()

    while queue:
        current_node, idx, path = queue.popleft()

        state = (current_node, idx)
        if state in visited:
            continue
        visited.add(state)

        # end condition check
        if idx == len(path_names):
            if current_node in end_nodes:
                path.append({"name": end, "nodes": [current_node]})
                return path
            continue

        target_name = path_names[idx]

        # Area transition
        if "apron" in target_name.lower():
            if current_node in node_to_areas:
                for area_name in node_to_areas[current_node]:
                    if area_name == target_name:
                        for next_node in area_map[area_name]:
                            if next_node == current_node:
                                continue

                            queue.append((
                                next_node,
                                idx + 1,
                                path + [{
                                    "name": target_name,
                                    "nodes": [current_node, next_node]
                                }]
                            ))

        found_match = False

        # First try to follow the required label
        for e in graph[current_node]:
            if compare_name(e["name"], target_name):
                found_match = True
                queue.append((
                    e["to"],
                    idx + 1,
                    path + [{
                        "name": e["name"],
                        "nodes": [current_node, e["to"]]
                    }]
                ))

        # If no edges matched the target label, expand using previous label
        if not found_match and idx > 1:
            prev_label = path_names[idx - 1]

            for e in graph[current_node]:
                if compare_name(e["name"], prev_label):
                    queue.append((
                        e["to"],
                        idx,  # stay on same label
                        path + [{
                            "name": e["name"],
                            "nodes": [current_node, e["to"]]
                        }]
                    ))

    return "PATH CANNOT BE COMPLETED"