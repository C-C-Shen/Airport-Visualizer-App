import React, { useRef, useState, useEffect } from "react";
import type { Node, Edge, POI, Area } from "../data/types";
import { Tool } from "../data/types";

type Props = {
  nodes: Node[];
  edges: Edge[];
  pois: POI[];
  areas: Area[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setPois: React.Dispatch<React.SetStateAction<POI[]>>;
  setAreas: React.Dispatch<React.SetStateAction<Area[]>>;
};

type modifyMode = "edge" | "poi" | "area" | null;

export default function CanvasEditor({
  nodes,
  edges,
  pois,
  areas,
  setNodes,
  setEdges,
  setPois,
  setAreas,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>(Tool.NODE);
  const [selectedPOINode, setSelectedPOINode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedAreaNodes, setSelectedAreaNodes] = useState<Node[]>([]);
  const [modifyMode, setModifyMode] = useState<ModifyMode>(null);
  const [draggingNode, setDraggingNode] = useState<Node | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // pan
  const [scale, setScale] = useState(1); // zoom

  function getMousePos(evt: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();

    const screenX = evt.clientX - rect.left;
    const screenY = evt.clientY - rect.top;

    return {
      x: (screenX - offset.x) / scale,
      y: (screenY - offset.y) / scale,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== Tool.MOVE) return;

    const pos = getMousePos(e);
    const node = findNode(pos);

    if (node) {
      setDraggingNode(node);
    }
  }

  // VIEW CONTROLS
  function zoom(factor: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const newScale = Math.max(0.2, Math.min(scale * factor, 5));
    const scaleRatio = newScale / scale;

    setOffset({
      x: cx - (cx - offset.x) * scaleRatio,
      y: cy - (cy - offset.y) * scaleRatio,
    });

    setScale(newScale);
  }

  function pan(dx: number, dy: number) {
    setOffset((o) => ({
      x: o.x + dx,
      y: o.y + dy,
    }));
  }

  function zoomIn() {
    zoom(1.2);
  }

  function zoomOut() {
    zoom(1 / 1.2);
  }

  function resetView() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleMouseUp() {
    if (tool !== Tool.MOVE) return;
    setDraggingNode(null);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== Tool.MOVE || !draggingNode) return;

    const pos = getMousePos(e);

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

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // if in the middle of moving nodes, don't process clicks
    if (tool === Tool.MOVE) return;

    const pos = getMousePos(e);

    // =========================
    // MODIFICATION MODE
    // =========================
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
      const pos = getMousePos(e);

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
          id: `N${nodes.length}`,
          x: snapX,
          y: snapY,
        };

        const edge1: Edge = {
          id: `E${edges.length}`,
          name: clickedEdge.name,
          type: clickedEdge.type,
          from_node: n1.id,
          to_node: newNode.id,
        };

        const edge2: Edge = {
          id: `E${edges.length + 1}`,
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
        id: `N${nodes.length}`,
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

    if (tool === Tool.EDGE || tool === Tool.RUNWAY) {
      const clicked = findNode(pos);
      if (!clicked) return;

      if (!selectedNode) {
        setSelectedNode(clicked);
      } else {
        if (selectedNode.id === clicked.id) {
          alert(
            "Cannot create an edge/runway with the same start and end node.",
          );
          setSelectedNode(null);
          return;
        }
        const isRunway = tool === Tool.RUNWAY;

        // Prompt user for edge name
        const defaultName = isRunway ? "01" : "A";
        const name = prompt(
          isRunway ? "Enter runway name (e.g. 23)" : "Enter taxiway name",
          defaultName,
        );
        if (!name) {
          setSelectedNode(null);
          return;
        }

        const newEdge: Edge = {
          id: `E${edges.length}`,
          name: name,
          type: isRunway ? "runway" : "taxiway",
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

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 800, 600);

    ctx.save();

    // Apply camera transform
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    ctx.clearRect(0, 0, 800, 600);

    // draw edges
    edges.forEach((e) => {
      const n1 = nodes.find((n) => n.id === e.from_node);
      const n2 = nodes.find((n) => n.id === e.to_node);
      if (!n1 || !n2) return;

      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.strokeStyle = e.type === "runway" ? "black" : "blue";
      ctx.lineWidth = e.type === "runway" ? 6 : 2;
      ctx.stroke();

      ctx.fillText(e.name, (n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
    });

    // draw nodes
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "red";
      ctx.fill();

      // draw node id
      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.fillText(n.id, n.x + 6, n.y - 6);

      // highlight selected POI node
      if (selectedPOINode?.id === n.id) {
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // draw POIs
    pois.forEach((p) => {
      const n = nodes.find((n) => n.id === p.node_id);
      if (!n) return;

      // draw POI marker
      ctx.beginPath();
      ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();

      // label
      ctx.fillStyle = "black";

      let label = p.type;

      if (p.type === "hold_short" && p.runway) {
        label = `HS ${p.runway}`;
      }

      ctx.fillText(label, n.x + 8, n.y - 8);
    });

    areas.forEach((area) => {
      const areaNodes = area.node_ids
        .map((id) => nodes.find((n) => n.id === id))
        .filter(Boolean) as Node[];

      if (areaNodes.length < 3) return; // need at least 3 points

      ctx.beginPath();
      ctx.moveTo(areaNodes[0].x, areaNodes[0].y);
      areaNodes.slice(1).forEach((n) => ctx.lineTo(n.x, n.y));
      ctx.closePath();

      ctx.fillStyle = "rgba(200, 200, 0, 0.3)"; // yellowish transparent
      ctx.fill();

      // label
      ctx.fillStyle = "black";
      const avgX =
        areaNodes.reduce((sum, n) => sum + n.x, 0) / areaNodes.length;
      const avgY =
        areaNodes.reduce((sum, n) => sum + n.y, 0) / areaNodes.length;
      ctx.fillText(area.name, avgX, avgY);
    });

    ctx.restore();
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
                id: `AR${areas.length}`,
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

      {/* VIEW CONTROLS */}
      <div style={{ marginBottom: "10px" }}>
        <strong>View Controls</strong>
        <br />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 40px)",
            gridTemplateRows: "repeat(3, 40px)",
            gap: "6px",
            marginTop: "10px",
          }}
        >
          {/* Row 1 */}
          <div />
          <button onClick={() => pan(0, 50)}>↑</button>
          <button onClick={zoomIn}>+</button>

          {/* Row 2 */}
          <button onClick={() => pan(50, 0)}>←</button>
          <button onClick={resetView}>R</button>
          <button onClick={() => pan(-50, 0)}>→</button>

          {/* Row 3 */}
          <div />
          <button onClick={() => pan(0, -50)}>↓</button>
          <button onClick={zoomOut}>−</button>
        </div>
      </div>

      {/* CANVAS                */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ border: "1px solid black" }}
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
