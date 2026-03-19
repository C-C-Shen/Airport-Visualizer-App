from core.pathfinder import find_path

def get_node_path(airport_data, path_names):

    start = path_names[0]
    end = path_names[-1]

    node_path = find_path(airport_data, start, end, path_names)

    print(node_path)

    return {
        "path_names": path_names,
        "node_path": node_path
    }