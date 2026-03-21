export type Node = {
  id: string;
  x: number;
  y: number;
};

export type Edge = {
  id: string;
  name: string;
  type: "taxiway" | "runway" | "approach";
  from_node: string;
  to_node: string;
};

export type Area = {
  id: string;
  type: string;
  name: string;
  node_ids: string[];
};

export type POI = {
  id: string;
  type: "hold_short" | "runup";
  node_id: string;
  runway?: string;
};

export interface Chart {
  id: string;
  name: string;
  imageData?: string; // This will hold the Base64 string "data:image/png;base64,..."
  img?: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  width?: number;
  height?: number;
  z_index: number;
  visible: boolean;
}

export type Airport = {
  id: string;
  nodes: Node[];
  edges: Edge[];
  areas: Area[];
  pois: POI[];
  charts: Chart[];
};

export enum Tool {
  SELECT = "select",
  NODE = "node",
  EDGE = "edge",
  RUNWAY = "runway",
  APPROACH = "approach",
  AREA = "area",
  POI = "poi",
  DELETE = "delete",
  MOVE = "move"
}