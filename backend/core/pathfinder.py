from collections import deque

# get all nodes with area name
def get_area_nodes(areas, name):
    for area in areas:
        if name == area["name"]:
            return area["node_ids"]
        
    return None

# check if any elements in the lsits overlap
def check_list_contains(list1, list2):
    if any(item in list1 for item in list2):
        return True
    return False

# get all nodes with edge name
def get_all_edge_nodes(edges, name):
    matching_edges = get_all_edges(edges, name)
    nodes = set()
    for edge in matching_edges:
        # handle runways and taxiways
        ends = [edge["from_node"], edge["to_node"]]
        nodes.update(ends)

    return nodes

def get_all_edges(edges, name):
    edge_list = []
    for edge in edges:
        # handle runways and taxiways
        if ("/" in edge["name"] and name in edge["name"]) or (name == edge["name"]):
            edge_list.append(edge)
        
    return edge_list

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

        # 1) if any edge reaches the end_node, use it and finish
        if direct_to_end:
            best = direct_to_end[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            available_edges.remove(best)
            path.append(end_node)
            return path

        # 2) otherwise, if we can still move forward, take one step and loop again
        if connecting:
            best = connecting[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            available_edges.remove(best)
            # loop continues, trying to get closer to end_node
            continue

        # 3) no way to expand and we never hit end_node
        return False

def find_path(airport_data, start, end, path_names):
    # Resolve start and end nodes
    def resolve(name):
        if "apron" in name.lower():
            return {"name": name, "nodes": get_area_nodes(airport_data["areas"], name)}
        return {"name": name, "nodes": get_all_edge_nodes(airport_data["edges"], name)}

    start_nodes = resolve(start)
    end_nodes = resolve(end)

    if not start_nodes or not end_nodes:
        return "INVALID START / END"

    remaining = path_names[1:-1]
    path = [start_nodes]

    for target_name in remaining:
        # print(f"Current Path {path}")

        previous = path[-1]
        target_nodes = {
            "name": target_name,
            "nodes": get_all_edge_nodes(airport_data["edges"], target_name)
        }

        # All edges with this name
        candidate_edges = get_all_edges(airport_data["edges"], target_name)

        # Find all edges that connect to the current path
        connecting = []
        direct_to_target = []
        direct_to_final = []

        for e in candidate_edges:
            next_nodes = [e["from_node"], e["to_node"]]

            if check_list_contains(previous["nodes"], next_nodes):
                connecting.append(e)

                # Connects to the next required name?
                if check_list_contains(target_nodes["nodes"], next_nodes):
                    direct_to_target.append(e)

                # Connects to the final destination?
                if check_list_contains(end_nodes["nodes"], next_nodes):
                    direct_to_final.append(e)

        # -------------------------------
        # Now choose the best option
        # -------------------------------

        # Only allow jumping to FINAL if this is the LAST required name
        is_last_required = (target_name == remaining[-1])

        if is_last_required and direct_to_final:
            best = direct_to_final[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            continue

        # Prefer edges that reach the next required name
        if direct_to_target:
            best = direct_to_target[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            continue

        # Otherwise pick any connecting edge
        if connecting:
            best = connecting[0]
            path.append({"name": best["name"], "nodes": [best["from_node"], best["to_node"]]})
            continue


        # 2) No direct connection — expand from current
        print("No direct connection, expanding…")

        previous_edges = get_all_edges(airport_data["edges"], previous["name"])
        expanded = expand_on_current(path, previous_edges, target_nodes)

        if not expanded:
            return "PATH CANNOT BE COMPLETED"

        path = expanded  # update path after expansion

    # Final step: connect last required name to end
    final_edges = get_all_edges(airport_data["edges"], remaining[-1])
    expanded = expand_on_current(path, final_edges, end_nodes)

    return expanded if expanded else "PATH CANNOT BE COMPLETED"
