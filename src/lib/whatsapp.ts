import { Department } from "./types";

const MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-IN");
const prettyDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-");
  return `${d}-${MON_SHORT[Number(m) - 1]}-${y}`;
};

export function buildWastageMessage(
  plantLabel: string, dateStr: string, schema: Department[],
  values: Record<string, Record<string, number>>, notes: string, total: number
) {
  const lines: string[] = [];
  lines.push(`📊 ${plantLabel.toUpperCase()} – WASTAGE REPORT`);
  lines.push(`📅 Date: ${prettyDate(dateStr)}`);
  lines.push(`👷 Shift: A + B`);
  schema.forEach((dep) => {
    lines.push(`🔹 ${dep.name}`);
    dep.items.forEach((item) => lines.push(`• ${item}: ${fmt(values[dep.name]?.[item] ?? 0)} kg`));
    Object.keys(values[dep.name] || {}).filter((k) => !dep.items.includes(k)).forEach((item) =>
      lines.push(`• ${item}: ${fmt(values[dep.name][item])} kg`)
    );
  });
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`📌 Total Wastage: ${fmt(total)} kg`);
  lines.push("━━━━━━━━━━━━━━━━━━");
  if (notes?.trim()) lines.push(`📝 Notes: ${notes.trim()}`);
  return lines.join("\n");
}

export function buildProductionMessage(
  plantLabel: string, dateStr: string,
  shiftA: { rows: { name: string; qty: number }[]; lumps: number; stopped: boolean },
  shiftB: { rows: { name: string; qty: number }[]; lumps: number; stopped: boolean },
  notes: string
) {
  const lines: string[] = [];
  lines.push(`🏭 ${plantLabel.toUpperCase()} – PRODUCTION REPORT`);
  lines.push(`📅 Date: ${prettyDate(dateStr)}`);
  ([["A", shiftA], ["B", shiftB]] as const).forEach(([label, data]) => {
    lines.push(`🔹 Shift ${label}`);
    if (data.stopped) {
      lines.push(`• Plant Stopped`);
    } else {
      data.rows.forEach((r) => lines.push(`• ${r.name || "—"}: ${fmt(r.qty)} kg`));
      const shiftTotal = data.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      lines.push(`📌 Shift ${label} Production: ${fmt(shiftTotal)} kg`);
      lines.push(`📌 Shift ${label} Lumps: ${fmt(data.lumps)} kg`);
    }
  });
  lines.push("━━━━━━━━━━━━━━━━━━");
  const grand = shiftA.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0) + shiftB.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const lumpsTotal = (shiftA.stopped ? 0 : shiftA.lumps) + (shiftB.stopped ? 0 : shiftB.lumps);
  lines.push(`📌 Total Production: ${fmt(grand)} kg`);
  lines.push(`📌 Total Lumps: ${fmt(lumpsTotal)} kg`);
  lines.push("━━━━━━━━━━━━━━━━━━");
  if (notes?.trim()) lines.push(`📝 Notes: ${notes.trim()}`);
  return lines.join("\n");
}

export function buildGranulesMessage(dateStr: string, rows: { name: string; qty: number }[], notes: string, total: number) {
  const lines: string[] = [];
  lines.push(`📦 GRANULES ISSUE REPORT`);
  lines.push(`📅 Date: ${prettyDate(dateStr)}`);
  lines.push(`🔹 Material Issued`);
  rows.forEach((r) => lines.push(`• ${r.name || "—"}: ${fmt(r.qty)} kg`));
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`📌 Total Granules Issued: ${fmt(total)} kg`);
  lines.push("━━━━━━━━━━━━━━━━━━");
  if (notes?.trim()) lines.push(`📝 Notes: ${notes.trim()}`);
  return lines.join("\n");
}
