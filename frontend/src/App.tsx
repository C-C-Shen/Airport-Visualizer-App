import React, { useState } from "react";
import CanvasEditor from "./components/CanvasEditor";
import CanvasViewer from "./components/CanvasViewer";
import { saveAirport, loadAirport } from "./api";
import type { Airport, Node, Edge, POI, Area } from "./types";

export default function App() {
  const [inputId, setInputId] = useState<string>("");
  const [airportId, setAirportId] = useState<string>(""); // active ID

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // NEW: toggle between edit and view mode
  const [isEditing, setIsEditing] = useState<boolean>(true);

  async function handleSave() {
    setAirportId(inputId); // commit input → active

    const data: Airport = {
      id: inputId,
      nodes,
      edges,
      areas,
      pois,
    };

    await saveAirport(data);
  }

  async function handleLoad() {
    setAirportId(inputId); // commit input → active

    const data = await loadAirport(inputId);
    setNodes(data.nodes);
    setEdges(data.edges);
    setPois(data.pois);
    setAreas(data.areas);
  }

  return (
    <div>
      <h1>Airport Builder</h1>

      <input value={inputId} onChange={(e) => setInputId(e.target.value)} />

      <button onClick={handleSave}>Save</button>
      <button onClick={handleLoad}>Load</button>

      {/* NEW: Toggle button */}
      <button onClick={() => setIsEditing((prev) => !prev)}>
        {isEditing ? "Switch to Viewer" : "Switch to Editor"}
      </button>

      {/* Conditional rendering */}
      {isEditing ? (
        <CanvasEditor
          nodes={nodes}
          edges={edges}
          pois={pois}
          areas={areas}
          setNodes={setNodes}
          setEdges={setEdges}
          setPois={setPois}
          setAreas={setAreas}
        />
      ) : (
        <CanvasViewer
          nodes={nodes}
          edges={edges}
          pois={pois}
          areas={areas}
          airportId={airportId}
        />
      )}
    </div>
  );
}
