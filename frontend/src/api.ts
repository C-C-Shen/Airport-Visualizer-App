import type { Airport } from "./data/types";

const BASE = "http://localhost:8000";

export async function saveAirport(data: Airport): Promise<void> {
  await fetch(`${BASE}/airport`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export async function loadAirport(id: string): Promise<Airport> {
  const res = await fetch(`${BASE}/airport/${id}`);
  return await res.json();
}

export async function loadAllPaths(airportId: string) {
  const res = await fetch(`${BASE}/airport/${airportId}/all_paths`);
  if (!res.ok) {
    throw new Error(`Failed to load paths for airport ${airportId}`);
  }
  return await res.json();
}
