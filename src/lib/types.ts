export type PlantKey = "oldRp" | "newRp";

export interface Department {
  name: string;
  items: string[];
}

export type WastageValues = Record<string, Record<string, number>>;

export interface WastageEntry {
  id: string;
  plant: PlantKey;
  date: string;
  values: WastageValues;
  notes: string;
  saved: boolean;
}

export interface ProductionRow {
  id: string;
  name: string;
  qty: number;
}

export interface ShiftData {
  rows: ProductionRow[];
  lumps: number;
  stopped: boolean;
}

export interface ProductionEntry {
  id: string;
  plant: PlantKey;
  date: string;
  shift_a: ShiftData;
  shift_b: ShiftData;
  notes: string;
  saved: boolean;
}

export interface GranuleIssueEntry {
  date: string;
  rows: ProductionRow[];
  notes: string;
  saved: boolean;
}

export interface AdminRow {
  day: number;
  date: string;
  shiftA: number | null;
  shiftB: number | null;
  totalProduction: number;
  totalAmount: number;
  balance: number;
  shiftsRan: number;
}

export interface AdminOverall {
  production: number;
  amount: number;
  balance: number;
}
