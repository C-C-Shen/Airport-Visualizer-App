import React, { useState, useEffect } from "react";
import CanvasEditor from "./components/CanvasEditor";
import CanvasViewer from "./components/CanvasViewer";
import { saveAirport, loadAirport } from "./api";
// Ensure Chart is exported from your types file
import type { Airport, Node, Edge, POI, Area, Chart } from "./types";

export default function App() {
  const [inputId, setInputId] = useState<string>("");
  const [airportId, setAirportId] = useState<string>("");

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  // 1. ADD: Lifted charts state
  const [charts, setCharts] = useState<Chart[]>([]);

  const [isEditing, setIsEditing] = useState<boolean>(true);

  async function handleSave() {
    setAirportId(inputId);

    const data: Airport = {
      id: inputId,
      nodes,
      edges,
      areas,
      pois,
      // 2. ADD: Include charts in the save object
      charts,
    };

    await saveAirport(data);
    alert("Saved successfully!");
  }

  async function handleLoad() {
    setAirportId(inputId);

    try {
      const data = await loadAirport(inputId);
      // 3. ADD: Set charts from loaded data (default to empty array if missing)
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setPois(data.pois || []);
      setAreas(data.areas || []);
      setCharts(data.charts || []);
    } catch (err) {
      console.error("Failed to load:", err);
    }
  }

  useEffect(() => {
    charts.forEach((chart) => {
      if (chart.imageData && !chart.img) {
        const img = new Image();
        // If it starts with /charts, it's a URL from our backend
        // Otherwise, it's a fresh Base64 string from a new upload
        img.src = chart.imageData.startsWith("/charts") 
                  ? `http://localhost:8000${chart.imageData}` 
                  : chart.imageData;

        img.onload = () => {
          setCharts(prev => prev.map(c => 
            c.id === chart.id ? { ...c, img, width: img.width, height: img.height } : c
          ));
        };
      }
    });
  }, [charts]);

  return (
    <div>
      <h1>Airport Builder</h1>

      <input
        value={inputId}
        onChange={(e) => setInputId(e.target.value)}
        placeholder="Enter ID"
      />

      <button onClick={handleSave}>Save</button>
      <button onClick={handleLoad}>Load</button>

      <button onClick={() => setIsEditing((prev) => !prev)}>
        {isEditing ? "Switch to Viewer" : "Switch to Editor"}
      </button>

      {isEditing ? (
        <CanvasEditor
          nodes={nodes}
          edges={edges}
          pois={pois}
          areas={areas}
          charts={charts}
          setNodes={setNodes}
          setEdges={setEdges}
          setPois={setPois}
          setAreas={setAreas}
          setCharts={setCharts}
        />
      ) : (
        <CanvasViewer
          nodes={nodes}
          edges={edges}
          pois={pois}
          areas={areas}
          charts={charts}
          airportId={airportId}
          setCharts={setCharts}
        />
      )}
    </div>
  );
}
