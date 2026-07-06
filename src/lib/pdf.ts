import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Department, PlantKey, AdminRow, AdminOverall } from "./types";

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-IN");
const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function newLandscapeDoc(title: string, subtitle: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(subtitle, 40, 52);
  doc.setTextColor(0);
  return doc;
}

/** Wastage month sheet: dates as rows, departments as columns, day-total column. */
export function downloadWastagePdf(
  plantLabel: string, monthLabel: string, year: number, schema: Department[],
  rows: { date: string; deptTotals: number[]; rowTotal: number }[]
) {
  const doc = newLandscapeDoc(
    `ALLIANCE POLYSACKS — WASTAGE REPORT`,
    `${plantLabel} · ${monthLabel} ${year}`
  );

  const deptNames = schema.map((d) => d.name);
  const colTotals = new Array(deptNames.length).fill(0);
  let grand = 0;
  rows.forEach((r) => { r.deptTotals.forEach((v, i) => (colTotals[i] += v)); grand += r.rowTotal; });

  autoTable(doc, {
    startY: 68,
    head: [["Date", ...deptNames, "Total"]],
    body: rows.map((r) => [r.date, ...r.deptTotals.map(fmt), fmt(r.rowTotal)]),
    foot: [["TOTAL", ...colTotals.map(fmt), fmt(grand)]],
    styles: { font: "courier", fontSize: 8, halign: "right" },
    headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: "right" },
    footStyles: { fillColor: [230, 230, 230], textColor: 0, halign: "right", fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    theme: "grid",
  });

  doc.save(`wastage_${plantLabel.replace(/\s+/g, "_")}_${year}-${monthLabel}.pdf`);
}

/** Admin month sheet: Date | Shift A | Shift B | Total Production | Total Amount | Balance + overall totals. */
export function downloadAdminPdf(
  plantLabel: string, monthLabel: string, year: number,
  rows: AdminRow[], overall: AdminOverall, rate: number, dedBoth: number, dedOne: number
) {
  const doc = newLandscapeDoc(
    `ALLIANCE POLYSACKS — ADMIN REPORT`,
    `${plantLabel} · ${monthLabel} ${year} · Rate ${rate.toFixed(2)}/kg · Both shifts ${fmt(dedBoth)} · One shift ${fmt(dedOne)}`
  );

  autoTable(doc, {
    startY: 68,
    head: [["Date", "Shift A", "Shift B", "Total Production", "Total Amount", "Balance"]],
    body: rows.map((r) => [
      r.date,
      r.shiftA === null ? "-" : fmt(r.shiftA),
      r.shiftB === null ? "-" : fmt(r.shiftB),
      fmt(r.totalProduction),
      fmtMoney(r.totalAmount),
      fmtMoney(r.balance),
    ]),
    foot: [["TOTAL", "", "", fmt(overall.production), fmtMoney(overall.amount), fmtMoney(overall.balance)]],
    styles: { font: "courier", fontSize: 8.5, halign: "right" },
    headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: "right" },
    footStyles: { fillColor: [230, 230, 230], textColor: 0, halign: "right", fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    theme: "grid",
  });

  doc.save(`admin_${plantLabel.replace(/\s+/g, "_")}_${year}-${monthLabel}.pdf`);
}
