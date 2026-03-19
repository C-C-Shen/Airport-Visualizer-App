import React, { useState, useRef, useEffect } from "react";
import type { Node, Edge, POI, Area } from "../data/types";
import { loadAllPaths } from "../api";

type Props = {
  nodes: Node[];
  edges: Edge[];
  pois: POI[];
  areas: Area[];
  airportId: string;
};

export default function CanvasViewer({
  nodes,
  edges,
  pois,
  areas,
  airportId,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [callsigns, setCallsigns] = useState<Record<string, any>>({});
  const [selectedCallsign, setSelectedCallsign] = useState<string | null>(null);
  const highlightPath = selectedCallsign ? callsigns[selectedCallsign] : null;

  // camera state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    draw(ctx);
  }, [nodes, edges, pois, areas, highlightPath, scale, offset]);

  async function handleLoadCallsigns() {
    const data = await loadAllPaths(airportId);
    console.log(data);
    setCallsigns(data);

    // optional: auto-select first callsign
    const first = Object.keys(data)[0];
    if (first) setSelectedCallsign(first);
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

  function orderNodes(nodeIds: string[], nodes: Node[]) {
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const remaining = new Set(nodeIds);

    const ordered: string[] = [];
    let current = nodeIds[0];

    ordered.push(current);
    remaining.delete(current);

    while (remaining.size > 0) {
      const currNode = nodeMap[current];

      let next: string | null = null;
      let bestDist = Infinity;

      for (let id of remaining) {
        const n = nodeMap[id];
        const dist = Math.hypot(n.x - currNode.x, n.y - currNode.y);

        if (dist < bestDist) {
          bestDist = dist;
          next = id;
        }
      }

      if (!next) break;

      ordered.push(next);
      remaining.delete(next);
      current = next;
    }

    return ordered;
  }

  function drawArea(
    ctx: CanvasRenderingContext2D,
    nodeIds: string[],
    nodes: Node[],
    options: any = {},
  ) {
    const {
      highlight = false,
      fillColor = "orange",
      alpha = highlight ? 0.35 : 0.15,
    } = options;

    const pts = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean) as Node[];

    if (pts.length < 3) return;

    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    pts.sort((a, b) => {
      const angleA = Math.atan2(a.y - cy, a.x - cx);
      const angleB = Math.atan2(b.y - cy, b.x - cx);
      return angleA - angleB;
    });

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    ctx.closePath();

    ctx.save();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (highlight) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  function draw(ctx: CanvasRenderingContext2D) {
    // RESET + CLEAR
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 800, 600);

    // APPLY CAMERA
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

    // --- Draw edges ---
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

      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.fillText(e.name, (n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
    });

    const highlightPath = selectedCallsign ? callsigns[selectedCallsign] : null;

    if (highlightPath && highlightPath.node_path.length > 0) {
      ctx.lineWidth = 5;

      highlightPath.node_path.forEach((segment) => {
        const segNodes = segment.nodes;

        const nodeIds = Array.isArray(segNodes)
          ? segNodes
          : Object.keys(segNodes);

        if (nodeIds.length < 2) return;

        if (segment.name === "apron") {
          drawArea(ctx, nodeIds, nodes, { highlight: true });
          return;
        }

        const finalNodeIds =
          nodeIds.length > 2 ? orderNodes(nodeIds, nodes) : nodeIds;

        ctx.beginPath();

        finalNodeIds.forEach((id, i) => {
          const node = nodes.find((n) => n.id === id);
          if (!node) return;

          if (i === 0) ctx.moveTo(node.x, node.y);
          else ctx.lineTo(node.x, node.y);
        });

        ctx.strokeStyle = "orange";
        ctx.stroke();
      });
    }

    // --- Draw nodes ---
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "red";
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.fillText(n.id, n.x + 6, n.y - 6);
    });

    // --- Draw POIs ---
    pois.forEach((p) => {
      const n = nodes.find((n) => n.id === p.node_id);
      if (!n) return;

      ctx.beginPath();
      ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.font = "12px Arial";

      let label = p.type;
      if (p.type === "hold_short" && p.runway) {
        label = `HS ${p.runway}`;
      }

      ctx.fillText(label, n.x + 8, n.y - 8);
    });

    // --- Draw areas ---
    areas.forEach((area) => {
      const nodeIds = area.node_ids;
      if (!nodeIds || nodeIds.length < 3) return;

      drawArea(ctx, nodeIds, nodes, {
        highlight: false,
        fillColor: "rgba(200, 200, 0, 1)",
        alpha: 0.3,
      });

      const areaNodes = nodeIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter(Boolean) as Node[];

      if (areaNodes.length === 0) return;

      const avgX = areaNodes.reduce((s, n) => s + n.x, 0) / areaNodes.length;
      const avgY = areaNodes.reduce((s, n) => s + n.y, 0) / areaNodes.length;

      ctx.fillStyle = "black";
      ctx.font = "14px Arial";
      ctx.fillText(area.name, avgX, avgY);
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "10px",
        }}
      >
        {/* LEFT: Controls */}
        <div>
          <strong>Path Tools</strong>
          <br />

          <button onClick={handleLoadCallsigns}>Load Callsigns</button>

          <br />
          <br />

          <select
            value={selectedCallsign ?? ""}
            onChange={(e) => setSelectedCallsign(e.target.value)}
          >
            <option value="">-- Select Callsign --</option>
            {Object.keys(callsigns).map((cs) => (
              <option key={cs} value={cs}>
                {cs}
              </option>
            ))}
          </select>
        </div>

        {/* RIGHT: Assigned Route */}
        <div style={{ minWidth: "250px" }}>
          <strong>Assigned Route</strong>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "6px",
              padding: "6px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              background: "#f9f9f9",
              minHeight: "32px",
            }}
          >
            {selectedCallsign &&
              callsigns[selectedCallsign]?.assigned_path?.map(
                (segment: string, i: number, arr: string[]) => (
                  <React.Fragment key={i}>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "#e3f2fd",
                        border: "1px solid #90caf9",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      {segment}
                    </div>

                    {i < arr.length - 1 && (
                      <div style={{ alignSelf: "center", fontSize: "12px" }}>
                        →
                      </div>
                    )}
                  </React.Fragment>
                ),
              )}
          </div>
        </div>
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

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: "1px solid #ccc", background: "white" }}
      />
    </div>
  );
}
