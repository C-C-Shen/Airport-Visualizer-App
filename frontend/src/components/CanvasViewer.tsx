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
  const [highlightPath, setHighlightPath] = useState<{
    path_names: string[];
    node_path: any[];
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    draw(ctx);
  }, [nodes, edges, pois, areas, highlightPath]);

  async function handleShowPath() {
    const data = await loadAllPaths(airportId);

    setHighlightPath(data);
  }

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 800, 600);

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

    // --- Highlight path edges ---
    if (highlightPath && highlightPath.node_path.length > 0) {
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 5;

      highlightPath.node_path.forEach((segment) => {
        const segNodes = segment.nodes;

        const nodeIds = Array.isArray(segNodes)
          ? segNodes
          : Object.keys(segNodes);

        if (nodeIds.length < 2) return;

        const n1 = nodes.find((n) => n.id === nodeIds[0]);
        const n2 = nodes.find((n) => n.id === nodeIds[1]);
        if (!n1 || !n2) return;

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
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
      const areaNodes = area.node_ids
        .map((id) => nodes.find((n) => n.id === id))
        .filter(Boolean) as Node[];

      if (areaNodes.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(areaNodes[0].x, areaNodes[0].y);
      areaNodes.slice(1).forEach((n) => ctx.lineTo(n.x, n.y));
      ctx.closePath();

      ctx.fillStyle = "rgba(200, 200, 0, 0.3)";
      ctx.fill();

      const avgX = areaNodes.reduce((s, n) => s + n.x, 0) / areaNodes.length;
      const avgY = areaNodes.reduce((s, n) => s + n.y, 0) / areaNodes.length;

      ctx.fillStyle = "black";
      ctx.font = "14px Arial";
      ctx.fillText(area.name, avgX, avgY);
    });
  }

  return (
    <div>
      <h2>Airport Viewer</h2>
      <button onClick={handleShowPath}>Show Path</button>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: "1px solid #ccc", background: "white" }}
      />
    </div>
  );
}
