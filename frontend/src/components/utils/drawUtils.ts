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

export function drawEdges(ctx, nodes, edges) {
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

    ctx.fillText(e.name, (n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
  });
}

export function drawNodes(ctx, nodes) {
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
}

export function drawPOIs(ctx, nodes, pois) {
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
}

export function drawAreas(ctx, nodes, areas) {
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