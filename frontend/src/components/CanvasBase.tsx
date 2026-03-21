import React, { useRef, useEffect, useState } from "react";
import type { Chart } from "../data/types";

type Props = {
  draw: (ctx: CanvasRenderingContext2D) => void;
  onClick?: (pos: { x: number; y: number }, e: React.MouseEvent) => void;
  onMouseDown?: (pos: { x: number; y: number }, e: React.MouseEvent) => void;
  onMouseMove?: (pos: { x: number; y: number }, e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  offset: { x: number; y: number };
  scale: number;
  charts: Chart[];
  setOffset?: (offset: { x: number; y: number }) => void;
  setScale?: (scale: number) => void;
  setCharts: React.Dispatch<React.SetStateAction<Chart[]>>;
};

export default function CanvasBase({
  draw,
  onClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  offset,
  scale,
  charts,
  setOffset,
  setScale,
  setCharts,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // New State for Chart Modification
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  function screenToWorld(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { x: (sx - offset.x) / scale, y: (sy - offset.y) / scale };
  }

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const img = new Image();
        img.src = base64Data;

        img.onload = () => {
          // 1. Get Canvas dimensions
          const canvasW = canvasRef.current?.width || 1000;
          const canvasH = canvasRef.current?.height || 1000;

          // 2. Calculate a scale that fits the high-res image into the view
          // Using 0.9 to ensure it's not touching the very edges of the canvas
          const scaleToFit = Math.min(
            (canvasW * 0.9) / img.width,
            (canvasH * 0.9) / img.height,
            1.0, // Prevent stretching small images
          );

          // 3. Convert Screen Center to World Coordinates
          // This ensures the chart lands in the middle of where you are looking,
          // even if you are panned or zoomed.
          const worldCenterX = (canvasW / 2 - offset.x) / scale;
          const worldCenterY = (canvasH / 2 - offset.y) / scale;

          // 4. Final Dimensions in World Space
          const worldW = img.width * scaleToFit;
          const worldH = img.height * scaleToFit;

          const newChart: Chart = {
            id: `chart_${Date.now()}_${idx}`,
            name: file.name,
            imageData: base64Data,
            img: img,
            // Center the chart relative to the current world-view center
            x: worldCenterX - worldW / 2,
            y: worldCenterY - worldH / 2,
            scale: scaleToFit,
            width: img.width,
            height: img.height,
            z_index: charts.length + idx,
            visible: true,
          };

          setCharts((prev) => [...prev, newChart]);
        };
      };
      reader.readAsDataURL(file);
      if (uploadKey > 100) {
        setUploadKey(prev => prev + 1);
      } else {
        setUploadKey(0);
      }
    });

    // 5. Reset the input so the same file can be re-uploaded if deleted
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Internal Mouse Handlers for Chart Modification
  const handleInternalMouseDown = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e);

    if (editingChartId) {
      const chart = charts.find((c) => c.id === editingChartId);
      if (chart) {
        const w = (chart.width || 0) * chart.scale;
        const h = (chart.height || 0) * chart.scale;
        const threshold = 15 / scale; // Grab area size

        // Define corners
        const corners = {
          tl: { x: chart.x, y: chart.y },
          tr: { x: chart.x + w, y: chart.y },
          bl: { x: chart.x, y: chart.y + h },
          br: { x: chart.x + w, y: chart.y + h },
        };

        // Check which corner is hit
        const hitCorner = Object.entries(corners).find(
          ([_, pos]) =>
            Math.abs(worldPos.x - pos.x) < threshold &&
            Math.abs(worldPos.y - pos.y) < threshold,
        );

        if (hitCorner) {
          setResizeCorner(hitCorner[0]);
          setIsResizing(true);
        } else if (
          worldPos.x >= chart.x &&
          worldPos.x <= chart.x + w &&
          worldPos.y >= chart.y &&
          worldPos.y <= chart.y + h
        ) {
          setIsDragging(true);
        }
        setDragStart(worldPos);
        return;
      }
    }
    onMouseDown?.(worldPos, e);
  };

  const handleInternalMouseMove = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e);

    if (editingChartId && isResizing && resizeCorner) {
      setCharts((prev) =>
        prev.map((c) => {
          if (c.id !== editingChartId) return c;

          const origW = c.width || 1;
          const origH = c.height || 1;
          const currentW = origW * c.scale;
          const currentH = origH * c.scale;

          let newScale = c.scale;

          // Logic: Scale is (Distance from Anchor to Mouse) / (Original Unscaled Dimension)
          // We use X-axis movement to drive the scale to maintain aspect ratio
          if (resizeCorner === "br") {
            // Anchor is TL
            newScale = (worldPos.x - c.x) / origW;
          } else if (resizeCorner === "bl") {
            // Anchor is TR
            newScale = (c.x + currentW - worldPos.x) / origW;
          } else if (resizeCorner === "tr") {
            // Anchor is BL
            newScale = (worldPos.x - c.x) / origW;
          } else if (resizeCorner === "tl") {
            // Anchor is BR
            newScale = (c.x + currentW - worldPos.x) / origW;
          }

          newScale = Math.max(0.05, newScale);
          const newW = origW * newScale;
          const newH = origH * newScale;

          let newX = c.x;
          let newY = c.y;

          // Anchor adjustments:
          if (resizeCorner === "tl") {
            newX = c.x + currentW - newW;
            newY = c.y + currentH - newH;
          } else if (resizeCorner === "tr") {
            newY = c.y + currentH - newH;
          } else if (resizeCorner === "bl") {
            newX = c.x + currentW - newW;
          }

          return { ...c, scale: newScale, x: newX, y: newY };
        }),
      );
      return;
    }

    // Dragging logic remains the same...
    if (editingChartId && isDragging) {
      const dx = worldPos.x - dragStart.x;
      const dy = worldPos.y - dragStart.y;
      setCharts((prev) =>
        prev.map((c) =>
          c.id === editingChartId ? { ...c, x: c.x + dx, y: c.y + dy } : c,
        ),
      );
      setDragStart(worldPos);
      return;
    }

    onMouseMove?.(worldPos, e);
  };

  const handleInternalMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    setIsResizing(false);
    onMouseUp?.(e);
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

    // Draw charts
    charts
      .filter((c) => c.visible && c.img)
      .sort((a, b) => a.z_index - b.z_index)
      .forEach((c) => {
        const w = (c.width || c.img!.width) * c.scale;
        const h = (c.height || c.img!.height) * c.scale;
        ctx.drawImage(c.img!, c.x, c.y, w, h);

        // Visual indicator for the chart being edited
        if (c.id === editingChartId) {
          ctx.strokeStyle = "#007bff";
          ctx.lineWidth = 2 / scale;
          ctx.strokeRect(c.x, c.y, w, h);
          // Draw resize handle
          ctx.fillStyle = "#007bff";
          ctx.fillRect(
            c.x + w - 5 / scale,
            c.y + h - 5 / scale,
            10 / scale,
            10 / scale,
          );
        }
      });

    draw(ctx);
  }, [draw, scale, offset, charts, editingChartId]);

  const pan = (dx: number, dy: number) =>
    setOffset!((o) => ({ x: o.x + dx, y: o.y + dy }));
  const zoom = (factor: number) => {
    const canvas = canvasRef.current!;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const newScale = Math.max(0.05, Math.min(scale * factor, 5));
    const ratio = newScale / scale;
    setOffset!({
      x: cx - (cx - offset.x) * ratio,
      y: cy - (cy - offset.y) * ratio,
    });
    setScale!(newScale);
  };

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="file"
          multiple
          accept="image/png"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <strong>Charts</strong>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            marginTop: "5px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f0f0f0" }}>
              <th style={{ border: "1px solid gray", padding: "4px" }}>Name</th>
              <th style={{ border: "1px solid gray", padding: "4px" }}>
                Modify
              </th>
              <th style={{ border: "1px solid gray", padding: "4px" }}>
                Visible
              </th>
              <th style={{ border: "1px solid gray", padding: "4px" }}>
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {charts.map((c) => (
              <tr
                key={c.id}
                style={{
                  backgroundColor:
                    editingChartId === c.id ? "#e7f3ff" : "transparent",
                }}
              >
                <td style={{ border: "1px solid gray", padding: "4px" }}>
                  {c.name}
                </td>
                <td
                  style={{
                    border: "1px solid gray",
                    padding: "4px",
                    textAlign: "center",
                  }}
                >
                  <button
                    onClick={() =>
                      setEditingChartId(editingChartId === c.id ? null : c.id)
                    }
                  >
                    {editingChartId === c.id ? "Done" : "Edit Pos/Size"}
                  </button>
                </td>
                <td
                  style={{
                    border: "1px solid gray",
                    padding: "4px",
                    textAlign: "center",
                  }}
                >
                  <button
                    onClick={() =>
                      setCharts((prev) =>
                        prev.map((ch) =>
                          ch.id === c.id ? { ...ch, visible: !ch.visible } : ch,
                        ),
                      )
                    }
                  >
                    {c.visible ? "Hide" : "Show"}
                  </button>
                </td>
                <td
                  style={{
                    border: "1px solid gray",
                    padding: "4px",
                    textAlign: "center",
                  }}
                >
                  <button
                    onClick={() =>
                      setCharts((prev) => prev.filter((ch) => ch.id !== c.id))
                    }
                  >
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Controls Snipped for brevity, same as yours */}
      <div style={{ marginBottom: "10px" }}>
        <strong>View Controls</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 40px)",
            gap: "6px",
            marginTop: "10px",
          }}
        >
          <div />
          <button onClick={() => pan(0, 50)}>↑</button>
          <button onClick={() => zoom(1.2)}>+</button>
          <button onClick={() => pan(50, 0)}>←</button>
          <button onClick={() => setScale!(1)}>R</button>
          <button onClick={() => pan(-50, 0)}>→</button>
          <div />
          <button onClick={() => pan(0, -50)}>↓</button>
          <button onClick={() => zoom(1 / 1.2)}>−</button>
        </div>

        {/* Zoom Level Display */}
        <div
          style={{
            padding: "10px",
            backgroundColor: "#f8f9fa",
            border: "1px solid #ddd",
            borderRadius: "4px",
            minWidth: "100px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>
            Zoom Level
          </div>
          <div
            style={{ fontSize: "18px", fontWeight: "bold", color: "#007bff" }}
          >
            {Math.round(scale * 100)}%
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        onClick={(e) => onClick?.(screenToWorld(e), e)}
        onMouseDown={handleInternalMouseDown}
        onMouseMove={handleInternalMouseMove}
        onMouseUp={handleInternalMouseUp}
        style={{
          border: "1px solid black",
          cursor: isDragging
            ? "grabbing"
            : isResizing
              ? "nwse-resize"
              : "default",
        }}
      />
    </div>
  );
}
