import React, { useRef, useState, useEffect } from "react";
import type { Node, Edge, POI, Area, Chart } from "../data/types";
import { Tool } from "../data/types";
import CanvasBase from "./CanvasBase";
import { drawEdges, drawNodes, drawPOIs, drawAreas } from "./utils/drawUtils";

type Props = {
  nodes: Node[];
  edges: Edge[];
  pois: POI[];
  areas: Area[];
  charts: Chart[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setPois: React.Dispatch<React.SetStateAction<POI[]>>;
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
  setCharts: React.Dispatch<React.SetStateAction<Chart[]>>;
};

type ModifyMode = "edge" | "poi" | "area" | null;

export default function CanvasEditor({
  nodes,
  edges,
  pois,
  areas,
  charts,
  setNodes,
  setEdges,
  setPois,
  setAreas,
  setCharts,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>(Tool.NODE);
  const [selectedPOINode, setSelectedPOINode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedAreaNodes, setSelectedAreaNodes] = useState<Node[]>([]);
  const [modifyMode, setModifyMode] = useState<ModifyMode>(null);
  const [draggingNode, setDraggingNode] = useState<Node | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const getNextId = (items: { id: string }[], prefix: string): string => {
    if (items.length === 0) return `${prefix}0`;

    // Extract numbers from IDs (e.g., "N12" -> 12), find max, and add 1
    const ids = items.map((item) => {
      const num = parseInt(item.id.replace(prefix, ""));
      return isNaN(num) ? -1 : num;
    });

    const maxId = Math.max(...ids);
    return `${prefix}${maxId + 1}`;
  };

  function handleMouseUp() {
    if (tool !== Tool.MOVE) return;
    setDraggingNode(null);
  }

  function handleMouseDown(pos: { x: number; y: number }, e: React.MouseEvent) {
    if (tool !== Tool.MOVE) return;

    const node = findNode(pos);
    if (node) setDraggingNode(node);
  }

  function handleMouseMove(pos: { x: number; y: number }, e: React.MouseEvent) {
    if (tool !== Tool.MOVE || !draggingNode) return;

    setNodes((prev) =>
      prev.map((n) =>
        n.id === draggingNode.id ? { ...n, x: pos.x, y: pos.y } : n,
      ),
    );
  }

  function findPOI(pos: { x: number; y: number }): POI | undefined {
    return pois.find((p) => {
      const n = nodes.find((n) => n.id === p.node_id);
      if (!n) return false;
      return Math.hypot(n.x - pos.x, n.y - pos.y) < 8;
    });
  }

  function findNode(pos: { x: number; y: number }): Node | undefined {
    return nodes.find((n) => Math.hypot(n.x - pos.x, n.y - pos.y) < 10);
  }

  function findEdge(pos: { x: number; y: number }): Edge | undefined {
    const threshold = 6;

    return edges.find((e) => {
      const n1 = nodes.find((n) => n.id === e.from_node);
      const n2 = nodes.find((n) => n.id === e.to_node);
      if (!n1 || !n2) return false;

      // distance from point to line segment
      const A = pos.x - n1.x;
      const B = pos.y - n1.y;
      const C = n2.x - n1.x;
      const D = n2.y - n1.y;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      const param = lenSq !== 0 ? dot / lenSq : -1;

      let xx, yy;

      if (param < 0) {
        xx = n1.x;
        yy = n1.y;
      } else if (param > 1) {
        xx = n2.x;
        yy = n2.y;
      } else {
        xx = n1.x + param * C;
        yy = n1.y + param * D;
      }

      const dx = pos.x - xx;
      const dy = pos.y - yy;

      return Math.sqrt(dx * dx + dy * dy) < threshold;
    });
  }

  function handleClick(pos: { x: number; y: number }, e: React.MouseEvent) {
    // use pos directly; no getMousePos needed
    // if in the middle of moving nodes, don't process clicks
    if (tool === Tool.MOVE) return;

    // MODIFICATION MODE
    if (modifyMode === "edge") {
      const clickedEdge = findEdge(pos);
      if (clickedEdge) {
        const newName = prompt("Edge name", clickedEdge.name);
        if (!newName) return;

        setEdges((prev) =>
          prev.map((e) =>
            e.id === clickedEdge.id ? { ...e, name: newName } : e,
          ),
        );
      }
      return;
    }

    if (modifyMode === "poi") {
      const clickedPOI = findPOI(pos);
      if (clickedPOI) {
        const newType = prompt("POI type", clickedPOI.type);
        if (!newType) return;

        let runway = clickedPOI.runway;

        if (newType === "hold_short") {
          runway = prompt("Runway", clickedPOI.runway || "") || undefined;
        }

        setPois((prev) =>
          prev.map((p) =>
            p.id === clickedPOI.id
              ? { ...p, type: newType as POI["type"], runway }
              : p,
          ),
        );
      }
      return;
    }

    if (modifyMode === "area") {
      const clickedArea = areas.find((area) => {
        const areaNodes = area.node_ids
          .map((id) => nodes.find((n) => n.id === id))
          .filter(Boolean) as Node[];
        if (areaNodes.length < 3) return false;

        let inside = false;
        for (
          let i = 0, j = areaNodes.length - 1;
          i < areaNodes.length;
          j = i++
        ) {
          const xi = areaNodes[i].x,
            yi = areaNodes[i].y;
          const xj = areaNodes[j].x,
            yj = areaNodes[j].y;

          const intersect =
            yi > pos.y !== yj > pos.y &&
            pos.x < ((xj - xi) * (pos.y - yi)) / (yj - yi + 0.00001) + xi;

          if (intersect) inside = !inside;
        }
        return inside;
      });

      if (clickedArea) {
        const newName = prompt("Area name", clickedArea.name);
        if (!newName) return;

        setAreas((prev) =>
          prev.map((a) =>
            a.id === clickedArea.id ? { ...a, name: newName } : a,
          ),
        );
      }

      return;
    }

    // =========================
    // DELETE MODE
    // =========================
    if (tool === Tool.DELETE) {
      const clickedNode = findNode(pos);
      const clickedEdge = findEdge(pos);
      const clickedPOI = findPOI(pos);

      // 1. DELETE NODE (and all references)
      if (clickedNode) {
        const nodeId = clickedNode.id;

        // remove node
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));

        // remove edges touching this node
        setEdges((prev) =>
          prev.filter((e) => e.from_node !== nodeId && e.to_node !== nodeId),
        );

        // remove POIs on this node
        setPois((prev) => prev.filter((p) => p.node_id !== nodeId));

        // remove areas containing this node
        setAreas(
          (prev) =>
            prev
              .map((a) => ({
                ...a,
                node_ids: a.node_ids.filter((id) => id !== nodeId),
              }))
              .filter((a) => a.node_ids.length >= 3), // keep only valid polygons
        );

        return;
      }

      // 2. DELETE EDGE ONLY
      if (clickedEdge) {
        setEdges((prev) => prev.filter((e) => e.id !== clickedEdge.id));
        return;
      }

      // 3. DELETE POI ONLY
      if (clickedPOI) {
        setPois((prev) => prev.filter((p) => p.id !== clickedPOI.id));
        return;
      }

      // 4. DELETE AREA (point‑in‑polygon)
      const clickedArea = areas.find((area) => {
        const areaNodes = area.node_ids
          .map((id) => nodes.find((n) => n.id === id))
          .filter(Boolean) as Node[];
        if (areaNodes.length < 3) return false;

        let inside = false;
        for (
          let i = 0, j = areaNodes.length - 1;
          i < areaNodes.length;
          j = i++
        ) {
          const xi = areaNodes[i].x,
            yi = areaNodes[i].y;
          const xj = areaNodes[j].x,
            yj = areaNodes[j].y;

          const intersect =
            yi > pos.y !== yj > pos.y &&
            pos.x < ((xj - xi) * (pos.y - yi)) / (yj - yi + 0.00001) + xi;

          if (intersect) inside = !inside;
        }
        return inside;
      });

      if (clickedArea) {
        setAreas((prev) => prev.filter((a) => a.id !== clickedArea.id));
        return;
      }

      return;
    }

    if (tool === Tool.NODE) {
      const clickedEdge = findEdge(pos);
      if (clickedEdge) {
        const n1 = nodes.find((n) => n.id === clickedEdge.from_node)!;
        const n2 = nodes.find((n) => n.id === clickedEdge.to_node)!;

        // Snap node to edge
        const A = pos.x - n1.x;
        const B = pos.y - n1.y;
        const C = n2.x - n1.x;
        const D = n2.y - n1.y;
        const lenSq = C * C + D * D;
        const dot = A * C + B * D;
        let t = lenSq !== 0 ? dot / lenSq : 0;
        t = Math.max(0, Math.min(1, t)); // clamp
        const snapX = n1.x + t * C;
        const snapY = n1.y + t * D;

        const newNode: Node = {
          id: getNextId(nodes, "N"),
          x: snapX,
          y: snapY,
        };

        const edge1: Edge = {
          id: getNextId(nodes, "E"),
          name: clickedEdge.name,
          type: clickedEdge.type,
          from_node: n1.id,
          to_node: newNode.id,
        };

        const edge2: Edge = {
          id: getNextId(nodes, "E"),
          name: clickedEdge.name,
          type: clickedEdge.type,
          from_node: newNode.id,
          to_node: n2.id,
        };

        setNodes((prev) => [...prev, newNode]);
        setEdges((prev) =>
          prev.filter((e) => e.id !== clickedEdge.id).concat([edge1, edge2]),
        );

        return;
      }

      // Normal node creation
      const newNode: Node = {
        id: getNextId(nodes, "N"),
        x: pos.x,
        y: pos.y,
      };
      setNodes((prev) => [...prev, newNode]);
    }

    if (tool === Tool.POI) {
      const clicked = findNode(pos);
      if (!clicked) return;

      // first click → select node
      if (!selectedPOINode) {
        setSelectedPOINode(clicked);
        return;
      }

      // second click → same node → create/edit POI
      if (selectedPOINode.id === clicked.id) {
        const type = prompt("POI type (hold_short, gate, runup)");
        if (!type) {
          setSelectedPOINode(null);
          return;
        }

        let runway: string | undefined;

        if (type === "hold_short") {
          runway = prompt("Runway (e.g. 23)") || undefined;
        }

        const existing = pois.find((p) => p.node_id === clicked.id);
        if (existing) {
          return;
        }

        const newPOI: POI = {
          id: `P${pois.length}`,
          type: type as POI["type"],
          node_id: clicked.id,
          runway,
        };

        setPois((prev) => [...prev, newPOI]);
        setSelectedPOINode(null);
        return;
      }

      // clicked different node → switch selection
      setSelectedPOINode(clicked);
      return;
    }

    // Inside handleClick function, update the condition for edges:
    if (tool === Tool.EDGE || tool === Tool.RUNWAY || tool === Tool.APPROACH) {
      const clicked = findNode(pos);
      if (!clicked) return;

      if (!selectedNode) {
        setSelectedNode(clicked);
      } else {
        if (selectedNode.id === clicked.id) {
          alert("Cannot create a segment with the same start and end node.");
          setSelectedNode(null);
          return;
        }

        const isRunway = tool === Tool.RUNWAY;
        const isApproach = tool === Tool.APPROACH;

        // Validation for Approach logic
        if (isApproach) {
            const startHasPOI = pois.some(p => p.node_id === selectedNode.id);
            const endHasPOI = pois.some(p => p.node_id === clicked.id);
            const endIsRunwayEdge = edges.some(e => e.type === "runway" && (e.from_node === clicked.id || e.to_node === clicked.id));

            if (!startHasPOI) {
                alert("Approach segments should start at a POI (Fix).");
                return
            }

            if (!endHasPOI && !endIsRunwayEdge) {
                alert("Approach segments should end at a Runway or POI (Fix).");
                return
            }
        }

        // Prompt user for name
        const defaultName = isRunway ? "09" : (isApproach ? "FIXNAME" : "A");
        const namePrompt = isRunway ? "Runway name" : (isApproach ? "Waypoint/Fix Name" : "Taxiway name");
        
        const name = prompt(`Enter ${namePrompt}`, defaultName);
        if (!name) {
          setSelectedNode(null);
          return;
        }

        const newEdge: Edge = {
          id: getNextId(edges, "E"),
          name: name,
          type: isRunway ? "runway" : (isApproach ? "approach" : "taxiway"),
          from_node: selectedNode.id,
          to_node: clicked.id,
        };

        setEdges((prev) => [...prev, newEdge]);
        setSelectedNode(null);
      }
      return;
    }

    if (tool === Tool.AREA) {
      const clicked = findNode(pos);
      if (!clicked) return;

      // Avoid duplicate node selection
      if (selectedAreaNodes.some((n) => n.id === clicked.id)) return;

      setSelectedAreaNodes((prev) => [...prev, clicked]);
      return;
    }
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    draw(ctx);
  }, [nodes, edges, pois, areas, offset, scale]);

  return (
    <div>
      {/* CREATION TOOLS        */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Creation Tools</strong>
        <br />

        <button
          onClick={() => setTool(Tool.NODE)}
          style={{
            backgroundColor: tool === Tool.NODE ? "#d0eaff" : "white",
            border: tool === Tool.NODE ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Node
        </button>

        <button
          onClick={() => setTool(Tool.EDGE)}
          style={{
            backgroundColor: tool === Tool.EDGE ? "#d0eaff" : "white",
            border: tool === Tool.EDGE ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Taxiway
        </button>

        <button
          onClick={() => setTool(Tool.RUNWAY)}
          style={{
            backgroundColor: tool === Tool.RUNWAY ? "#d0eaff" : "white",
            border: tool === Tool.RUNWAY ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Runway
        </button>

        <button
          onClick={() => setTool(Tool.APPROACH)}
          style={{
            backgroundColor: tool === Tool.APPROACH ? "#d4edda" : "white", // Light green background
            border: tool === Tool.APPROACH ? "2px solid green" : "1px solid #ccc",
          }}
        >
          Approach
        </button>

        <button
          onClick={() => setTool(Tool.POI)}
          style={{
            backgroundColor: tool === Tool.POI ? "#d0eaff" : "white",
            border: tool === Tool.POI ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          POI
        </button>

        <button
          onClick={() => setTool(Tool.AREA)}
          style={{
            backgroundColor: tool === Tool.AREA ? "#d0eaff" : "white",
            border: tool === Tool.AREA ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Area
        </button>

        {tool === Tool.AREA && (
          <button
            disabled={selectedAreaNodes.length < 3}
            onClick={() => {
              const name = prompt("Enter area name (e.g. APRON, FUEL PUMPS)");
              if (!name) {
                setSelectedAreaNodes([]);
                setTool(Tool.AREA);
                return;
              }

              const newArea: Area = {
                id: getNextId(areas, "AR"),
                type: "apron",
                name,
                node_ids: selectedAreaNodes.map((n) => n.id),
              };

              setAreas((prev) => [...prev, newArea]);
              setSelectedAreaNodes([]);
              setTool(Tool.AREA);
            }}
            style={{
              backgroundColor: "#d0eaff",
              border: "2px solid blue",
              marginLeft: "6px",
            }}
          >
            Set Area
          </button>
        )}

        <button
          onClick={() => {
            setTool(null);
            setSelectedNode(null);
            setSelectedPOINode(null);
            setSelectedAreaNodes([]);
          }}
          style={{ marginLeft: "6px" }}
        >
          Exit Create Mode
        </button>
      </div>

      {/* DELETION TOOLS        */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Deletion Tools</strong>
        <br />

        <button
          onClick={() => setTool(Tool.DELETE)}
          style={{
            backgroundColor: tool === Tool.DELETE ? "#fc8672" : "white",
            border: tool === Tool.DELETE ? "2px solid red" : "1px solid #ccc",
          }}
        >
          Delete
        </button>

        <button onClick={() => setTool(null)} style={{ marginLeft: "6px" }}>
          Exit Delete Mode
        </button>
      </div>

      {/* MODIFICATION TOOLS */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Modification Tools</strong>
        <br />

        <button
          onClick={() => {
            setModifyMode("edge");
            setTool(null);
          }}
          style={{
            backgroundColor: modifyMode === "edge" ? "#d0eaff" : "white",
            border: modifyMode === "edge" ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Rename Edges
        </button>

        <button
          onClick={() => {
            setModifyMode("poi");
            setTool(null);
          }}
          style={{
            backgroundColor: modifyMode === "poi" ? "#d0eaff" : "white",
            border: modifyMode === "poi" ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Rename POIs
        </button>

        <button
          onClick={() => {
            setModifyMode("area");
            setTool(null);
          }}
          style={{
            backgroundColor: modifyMode === "area" ? "#d0eaff" : "white",
            border: modifyMode === "area" ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Rename Areas
        </button>

        <button
          onClick={() => {
            setTool(Tool.MOVE);
            setModifyMode(null);
            setDraggingNode(null);
            setSelectedNode(null);
            setSelectedPOINode(null);
            setSelectedAreaNodes([]);
          }}
          style={{
            backgroundColor: tool === Tool.MOVE ? "#d0eaff" : "white",
            border: tool === Tool.MOVE ? "2px solid blue" : "1px solid #ccc",
          }}
        >
          Move Node
        </button>

        <button
          onClick={() => {
            setModifyMode(null);
            setTool(null);
            setDraggingNode(null);
          }}
        >
          Exit Modifications
        </button>
      </div>

      {/* CANVAS                */}
      <CanvasBase
        charts={charts}
        setCharts={setCharts}
        draw={(ctx) => {
          // Note: CanvasBase handles drawing the charts internally
          // We just draw the vector layers on top here
          drawEdges(ctx, nodes, edges);
          drawNodes(ctx, nodes);
          drawPOIs(ctx, nodes, pois);
          drawAreas(ctx, nodes, areas);

          // HIGHLIGHT SELECTED NODE
          if (selectedNode) {
            ctx.beginPath();
            ctx.arc(selectedNode.x, selectedNode.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = tool === Tool.APPROACH ? "green" : "blue";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }}
        onClick={(pos, e) => handleClick(pos, e)}
        onMouseDown={(pos, e) => handleMouseDown(pos, e)}
        onMouseMove={(pos, e) => handleMouseMove(pos, e)}
        onMouseUp={handleMouseUp}
        offset={offset}
        scale={scale}
        setOffset={setOffset}
        setScale={setScale}
      />

      {/* RESET BUTTON          */}
      <div style={{ marginTop: "10px" }}>
        <button
          onClick={() => {
            if (!confirm("Are you sure you want to reset the airport layout?"))
              return;
            setNodes([]);
            setEdges([]);
            setPois([]);
            setAreas([]);
            setCharts([]);
            setSelectedPOINode(null);
            setSelectedNode(null);
            setSelectedAreaNodes([]);
            setTool(Tool.NODE);
            setModifyMode(null);
          }}
          style={{
            backgroundColor: "white",
            border: "1px solid #ccc",
            color: "red",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
