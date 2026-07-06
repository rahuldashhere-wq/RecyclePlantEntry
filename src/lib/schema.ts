import { Department, PlantKey } from "./types";

export const OLD_WASTAGE: Department[] = [
  { name: "Tape Plant", items: ["Lumps", "Tape Wastage", "Out Pipe Cutting", "Bobbin Cleaning"] },
  { name: "Looms", items: ["Pipe Cutting", "Bobbin Cleaning", "Loom Fabric Wastage"] },
  { name: "Lamination", items: ["Lumps", "Lamination Fabric", "Lamination Palli", "Lamination Poly Wastage", "Lamination Tape Wastage", "Cutex Machine"] },
  { name: "Printing", items: ["Start-up Wastage"] },
  { name: "Slittec", items: ["Trimming Wastage"] },
  { name: "ADSTAR", items: ["Loom", "Lamination", "Printing", "Machine", "Sample Bags"] },
  { name: "Segregation", items: ["Loom", "Lamination", "Printing", "ADSTAR", "Folding"] },
  { name: "Others", items: ["QC", "Bailing", "ST Machine"] },
];

export const NEW_WASTAGE: Department[] = [
  { name: "Lamination", items: ["Lumps", "Lamination Fabric", "Lamination Poly Wastage", "Lamination Palli Wastage", "Lamination Tape Wastage"] },
  { name: "Printing", items: ["Start-up Wastage"] },
  { name: "Tubetec", items: ["Total Wastage"] },
  { name: "Slittec", items: ["Trim Wastage"] },
  { name: "ADSTAR", items: ["Loom", "Lamination", "Printing", "Machine", "Sample Bags"] },
  { name: "Segregation", items: ["Loom", "Lamination", "Printing", "ADSTAR", "Folding"] },
  { name: "Others", items: ["QC", "Bailing"] },
];

export const WASTAGE_SCHEMA: Record<PlantKey, Department[]> = { oldRp: OLD_WASTAGE, newRp: NEW_WASTAGE };
export const PLANT_LABEL: Record<PlantKey, string> = { oldRp: "Old RP Plant", newRp: "New RP Plant" };

export function emptyWastageValues(plant: PlantKey) {
  const out: Record<string, Record<string, number>> = {};
  WASTAGE_SCHEMA[plant].forEach((d) => {
    out[d.name] = {};
    d.items.forEach((item) => (out[d.name][item] = 0));
  });
  return out;
}
