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

  function orderNodes(nodeIds, nodes) {
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const remaining = new Set(nodeIds);

    const ordered = [];
    let current = nodeIds[0];

    ordered.push(current);
    remaining.delete(current);

    while (remaining.size > 0) {
      const currNode = nodeMap[current];

      let next = null;
      let bestDist = Infinity;

      for (let id of remaining) {
        const n = nodeMap[id];
        const dist = Math.hypot(n.x - currNode.x, n.y - currNode.y);

        if (dist < bestDist) {
          bestDist = dist;
          next = id;
        }
      }

      ordered.push(next);
      remaining.delete(next);
      current = next;
    }

    return ordered;
  }

  function drawArea(ctx, nodeIds, nodes, options = {}) {
    const {
      highlight = false,
      fillColor = "orange",
      alpha = highlight ? 0.35 : 0.15,
    } = options;

    const pts = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean);

    if (pts.length < 3) return;

    // order points
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

    // optional subtle border only when highlighted
    if (highlight) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
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

    if (highlightPath && highlightPath.node_path.length > 0) {
      ctx.lineWidth = 5;

      highlightPath.node_path.forEach((segment) => {
        const segNodes = segment.nodes;

        const nodeIds = Array.isArray(segNodes)
          ? segNodes
          : Object.keys(segNodes);

        if (nodeIds.length < 2) return;

        // HANDLE AREAS (apron)
        if (segment.name === "apron") {
          drawArea(ctx, nodeIds, nodes, { highlight: true });
          return;
        }

        // HANDLE NORMAL PATHS
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

      // use shared drawArea
      drawArea(ctx, nodeIds, nodes, {
        highlight: false,
        fillColor: "rgba(200, 200, 0, 1)", // base color (alpha handled inside)
        alpha: 0.3,
      });

      // --- label (unchanged) ---
      const areaNodes = nodeIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter(Boolean);

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
