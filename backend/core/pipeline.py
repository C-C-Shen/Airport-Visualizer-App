from core.pathfinder import find_path

def merge_paths_with_alignment(path1, path2):
    def to_set(nodes):
        return set(nodes) if not isinstance(nodes, set) else nodes

    merged = []

    i, j = 0, 0

    while i < len(path1) and j < len(path2):
        seg1 = path1[i]
        seg2 = path2[j]

        if seg1["name"] == seg2["name"]:
            # merge via intersection
            nodes1 = to_set(seg1["nodes"])
            nodes2 = to_set(seg2["nodes"])
            common = nodes1 & nodes2

            if common:
                merged.append({
                    "name": seg1["name"],
                    "nodes": list(common)
                })
            else:
                # fallback: keep path1 if no overlap
                merged.append(seg1)

            i += 1
            j += 1

        else:
            # mismatch → prioritize path1
            # skip element in path2 to realign
            j += 1

    return merged

def get_node_path(airport_data, path_names):

    start = path_names[0]
    end = path_names[-1]

    node_path = find_path(airport_data, start, end, path_names)
    node_path_reverse = find_path(airport_data, end, start, path_names[::-1])

    print(node_path)
    print(node_path_reverse[::-1])

    node_path = merge_paths_with_alignment(node_path, node_path_reverse[::-1])


    return {
        "path_names": path_names,
        "node_path": node_path
    }