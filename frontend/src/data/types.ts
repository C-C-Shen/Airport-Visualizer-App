export type Node = {
  id: string;
  x: number;
  y: number;
};

export type Edge = {
  id: string;
  name: string;
  type: "taxiway" | "runway";
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

export type Airport = {
  id: string;
  nodes: Node[];
  edges: Edge[];
  areas: Area[];
  pois: POI[];
};

export enum Tool {
  SELECT = "select",
  NODE = "node",
  EDGE = "edge",
  RUNWAY = "runway",
  AREA = "area",
  POI = "poi"
}