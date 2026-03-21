import React, { useState, useRef, useEffect } from "react";
import type { Node, Edge, POI, Area, Chart } from "../data/types";
import { loadAllPaths } from "../api";
import CanvasBase from "./CanvasBase";
import { drawEdges, drawNodes, drawPOIs, drawAreas } from "./utils/drawUtils";

type Props = {
  nodes: Node[];
  edges: Edge[];
  pois: POI[];
  areas: Area[];
  charts: Chart[];
  airportId: string;
  setCharts: React.Dispatch<React.SetStateAction<Chart[]>>;
};

export default function CanvasViewer({
  nodes,
  edges,
  pois,
  areas,
  charts,
  airportId,
  setCharts
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

  useEffect(() => {
    handleLoadCallsigns();
  }, [airportId]);

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

  function drawHighlightedPath(ctx: CanvasRenderingContext2D) {
    const highlightPath = selectedCallsign ? callsigns[selectedCallsign] : null;

    if (highlightPath && highlightPath.node_path.length > 0) {
      ctx.lineWidth = 5;

      highlightPath.node_path.forEach((segment) => {
        const segNodes = segment.nodes;

        const nodeIds = Array.isArray(segNodes)
          ? segNodes
          : Object.keys(segNodes);

        if (nodeIds.length < 2) return;

        // if (segment.name === "apron") {
        //   drawArea(ctx, nodeIds, nodes, { highlight: true });
        //   return;
        // }

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

      {/* CANVAS */}
      <CanvasBase
        charts={charts}
        setCharts={setCharts}
        draw={(ctx) => {
          drawEdges(ctx, nodes, edges);
          drawNodes(ctx, nodes);
          drawPOIs(ctx, nodes, pois);
          drawAreas(ctx, nodes, areas);

          // viewer-only: highlighted path
          drawHighlightedPath(ctx);
        }}
        offset={offset}
        scale={scale}
        setOffset={setOffset}
        setScale={setScale}
      />
    </div>
  );
}
