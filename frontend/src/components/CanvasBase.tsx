import React, { useRef, useEffect, useState } from "react";

type Props = {
  draw: (ctx: CanvasRenderingContext2D) => void;

  // mouse events
  onClick?: (pos: { x: number; y: number }, e: React.MouseEvent) => void;
  onMouseDown?: (pos: { x: number; y: number }, e: React.MouseEvent) => void;
  onMouseMove?: (pos: { x: number; y: number }, e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;

  // pan/zoom state
  offset: { x: number; y: number };
  scale: number;

  // optional: callbacks if you want CanvasBase to modify pan/zoom
  setOffset?: (offset: { x: number; y: number }) => void;
  setScale?: (scale: number) => void;
};

export default function CanvasBase({
  draw,
  onClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  offset,
  scale,
  setOffset,
  setScale,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function screenToWorld(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();

    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    return {
      x: (sx - offset.x) / scale,
      y: (sy - offset.y) / scale,
    };
  }

  function getCanvasPos(evt: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = evt.clientX - rect.left;
    const screenY = evt.clientY - rect.top;

    return {
      x: (screenX - offset.x) / scale,
      y: (screenY - offset.y) / scale,
    };
  }

  // =========================
  // DRAW LOOP
  // =========================
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 800, 600);

    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

    draw(ctx);
  }, [draw, scale, offset]);

  // =========================
  // VIEW CONTROLS
  // =========================
  function zoom(factor: number) {
    const canvas = canvasRef.current!;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const newScale = Math.max(0.2, Math.min(scale * factor, 5));
    const ratio = newScale / scale;

    setOffset({
      x: cx - (cx - offset.x) * ratio,
      y: cy - (cy - offset.y) * ratio,
    });

    setScale(newScale);
  }

  function pan(dx: number, dy: number) {
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  function resetView() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <div>
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
          <button onClick={() => zoom(1.2)}>+</button>

          {/* Row 2 */}
          <button onClick={() => pan(50, 0)}>←</button>
          <button onClick={resetView}>R</button>
          <button onClick={() => pan(-50, 0)}>→</button>

          {/* Row 3 */}
          <div />
          <button onClick={() => pan(0, -50)}>↓</button>
          <button onClick={() => zoom(1 / 1.2)}>−</button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={(e) => onClick?.(screenToWorld(e), e)}
        onMouseDown={(e) => onMouseDown?.(screenToWorld(e), e)}
        onMouseMove={(e) => onMouseMove?.(screenToWorld(e), e)}
        onMouseUp={onMouseUp}
        style={{ border: "1px solid black" }}
      />
    </div>
  );
}
