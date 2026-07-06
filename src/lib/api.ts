import { supabase } from "./supabase";
import { PlantKey, WastageEntry, ProductionEntry, GranuleIssueEntry, ShiftData } from "./types";
import { emptyWastageValues } from "./schema";

const rowId = (plant: PlantKey, date: string) => `${plant}_${date}`;
const blankShift = (): ShiftData => ({ rows: [], lumps: 0, stopped: false });

/* ---------------- listing dates ---------------- */

export async function listDatesForPlant(plant: PlantKey): Promise<string[]> {
  const { data, error } = await supabase
    .from("production_entries")
    .select("date")
    .eq("plant", plant)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.date as string);
}

export async function listGranuleDates(): Promise<string[]> {
  const { data, error } = await supabase.from("granule_issues").select("date").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.date as string);
}

export async function dateEntryExists(plant: PlantKey, date: string): Promise<boolean> {
  const { data, error } = await supabase.from("production_entries").select("id").eq("id", rowId(plant, date)).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function granuleDateExists(date: string): Promise<boolean> {
  const { data, error } = await supabase.from("granule_issues").select("date").eq("date", date).maybeSingle();
  if (error) throw error;
  return !!data;
}

/* ---------------- creating a fresh, guarded date entry ---------------- */

export async function createBlankDateEntry(plant: PlantKey, date: string) {
  if (await dateEntryExists(plant, date)) throw new Error("An entry for this date already exists.");

  const { error: e1 } = await supabase.from("wastage_entries").insert({
    id: rowId(plant, date), plant, date, values: emptyWastageValues(plant), notes: "", saved: false,
  });
  if (e1) throw e1;

  const { error: e2 } = await supabase.from("production_entries").insert({
    id: rowId(plant, date), plant, date, shift_a: blankShift(), shift_b: blankShift(), notes: "", saved: false,
  });
  if (e2) throw e2;
}

export async function createBlankGranuleEntry(date: string) {
  if (await granuleDateExists(date)) throw new Error("An entry for this date already exists.");
  const { error } = await supabase.from("granule_issues").insert({ date, rows: [], notes: "", saved: false });
  if (error) throw error;
}

/* ---------------- read / write a single day's wastage ---------------- */

export async function getWastageEntry(plant: PlantKey, date: string): Promise<WastageEntry | null> {
  const { data, error } = await supabase.from("wastage_entries").select("*").eq("id", rowId(plant, date)).maybeSingle();
  if (error) throw error;
  return data as WastageEntry | null;
}

export async function saveWastageEntry(entry: Omit<WastageEntry, "id">) {
  const { error } = await supabase.from("wastage_entries").upsert({ id: rowId(entry.plant, entry.date), ...entry, saved: true });
  if (error) throw error;
}

/* ---------------- read / write a single day's production ---------------- */

export async function getProductionEntry(plant: PlantKey, date: string): Promise<ProductionEntry | null> {
  const { data, error } = await supabase.from("production_entries").select("*").eq("id", rowId(plant, date)).maybeSingle();
  if (error) throw error;
  return data as ProductionEntry | null;
}

export async function saveProductionEntry(entry: Omit<ProductionEntry, "id">) {
  const { error } = await supabase.from("production_entries").upsert({ id: rowId(entry.plant, entry.date), ...entry, saved: true });
  if (error) throw error;
}

/* ---------------- read / write granule issue ---------------- */

export async function getGranuleEntry(date: string): Promise<GranuleIssueEntry | null> {
  const { data, error } = await supabase.from("granule_issues").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  return data as GranuleIssueEntry | null;
}

export async function saveGranuleEntry(entry: GranuleIssueEntry) {
  const { error } = await supabase.from("granule_issues").upsert({ ...entry, saved: true });
  if (error) throw error;
}

/* ---------------- month sheet for the Wastage Report ---------------- */

export async function getWastageMonth(plant: PlantKey, year: number, month: number) {
  const nDays = new Date(year, month, 0).getDate();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad2(month)}-01`;
  const to = `${year}-${pad2(month)}-${pad2(nDays)}`;

  const { data, error } = await supabase
    .from("wastage_entries")
    .select("*")
    .eq("plant", plant)
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;

  const byDate = new Map((data ?? []).map((e) => [e.date as string, e as WastageEntry]));
  return Array.from({ length: nDays }, (_, i) => {
    const date = `${year}-${pad2(month)}-${pad2(i + 1)}`;
    return { date, entry: byDate.get(date) ?? null };
  });
}

/* ---------------- month data for the Admin Report ---------------- */

export async function getProductionMonth(plant: PlantKey, year: number, month: number) {
  const nDays = new Date(year, month, 0).getDate();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad2(month)}-01`;
  const to = `${year}-${pad2(month)}-${pad2(nDays)}`;

  const { data, error } = await supabase
    .from("production_entries")
    .select("*")
    .eq("plant", plant)
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;

  const byDate = new Map((data ?? []).map((e) => [e.date as string, e as ProductionEntry]));
  return Array.from({ length: nDays }, (_, i) => {
    const date = `${year}-${pad2(month)}-${pad2(i + 1)}`;
    return { day: i + 1, date, entry: byDate.get(date) ?? null };
  });
}
