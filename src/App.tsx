import React, { useEffect, useState } from "react";
import {
  ArrowLeft, Search, Plus, Download, ChevronRight, ChevronDown, Check, X,
  Package, Factory, ClipboardList, Boxes, Calendar, AlertTriangle, FileText,
  BarChart3, Lock, Copy,
} from "lucide-react";
import { PlantKey, WastageValues, ShiftData, ProductionRow } from "./lib/types";
import { WASTAGE_SCHEMA, PLANT_LABEL, emptyWastageValues } from "./lib/schema";
import * as api from "./lib/api";
import { verifyAdminPasscode, getAdminReport, updateAdminSettings } from "./lib/adminApi";
import { downloadWastagePdf, downloadAdminPdf } from "./lib/pdf";
import { buildWastageMessage, buildProductionMessage, buildGranulesMessage } from "./lib/whatsapp";

const uid = () => Math.random().toString(36).slice(2, 8);
const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-IN");
const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Screen =
  | { name: "home" }
  | { name: "dateList"; plant: PlantKey | "granules" }
  | { name: "dateDetail"; plant: PlantKey; date: string }
  | { name: "wastageEntry"; plant: PlantKey; date: string }
  | { name: "productionEntry"; plant: PlantKey; date: string }
  | { name: "granulesEntry"; date: string }
  | { name: "wastageReportSetup" }
  | { name: "wastageReportSheet"; year: number; month: number; plant: PlantKey }
  | { name: "adminPasscode" }
  | { name: "adminReport"; passcode: string }
  | { name: "adminSettings"; passcode: string };

export default function App() {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const [toast, setToast] = useState("");
  const cur = stack[stack.length - 1];
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("WhatsApp format copied ✓");
    } catch {
      flash("Couldn't copy — try again");
    }
  };

  let body: React.ReactNode = null;
  if (cur.name === "home") body = <Home push={push} />;
  else if (cur.name === "dateList") body = <DateList plant={cur.plant} push={push} pop={pop} flash={flash} />;
  else if (cur.name === "dateDetail") body = <DateDetail plant={cur.plant} date={cur.date} push={push} pop={pop} />;
  else if (cur.name === "wastageEntry") body = <WastageEntry plant={cur.plant} date={cur.date} pop={pop} flash={flash} copyToClipboard={copyToClipboard} />;
  else if (cur.name === "productionEntry") body = <ProductionEntry plant={cur.plant} date={cur.date} pop={pop} flash={flash} copyToClipboard={copyToClipboard} />;
  else if (cur.name === "granulesEntry") body = <GranulesEntry date={cur.date} pop={pop} flash={flash} copyToClipboard={copyToClipboard} />;
  else if (cur.name === "wastageReportSetup") body = <WastageReportSetup push={push} pop={pop} />;
  else if (cur.name === "wastageReportSheet") body = <WastageReportSheet year={cur.year} month={cur.month} plant={cur.plant} pop={pop} />;
  else if (cur.name === "adminPasscode") body = <AdminPasscode push={push} pop={pop} />;
  else if (cur.name === "adminReport") body = <AdminReport passcode={cur.passcode} push={push} pop={pop} />;
  else if (cur.name === "adminSettings") body = <AdminSettings passcode={cur.passcode} pop={pop} flash={flash} />;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", background: "#f2f2f0", minHeight: "100vh" }}>
      <div style={{
        width: 420, background: "#fff", border: "8px solid #000", borderRadius: 34,
        overflow: "hidden", position: "relative", fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111", minHeight: 700,
      }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 120, height: 20, background: "#000", borderRadius: "0 0 12px 12px", zIndex: 5 }} />
        <div style={{ maxHeight: "90vh", overflowY: "auto" }}>{body}</div>
        <Toast msg={toast} />
      </div>
    </div>
  );
}

/* ================= shared bits ================= */

function TopBar({ title, subtitle, onBack, onSearch, onDownload, onCopy }: {
  title: string; subtitle?: string; onBack?: () => void; onSearch?: () => void; onDownload?: () => void; onCopy?: () => void;
}) {
  return (
    <div style={{ background: "#000", color: "#fff", padding: "14px 14px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack ? <button onClick={onBack} style={iconBtnDark} aria-label="Back"><ArrowLeft size={18} /></button> : <div style={{ width: 30 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace", marginTop: 1 }}>{subtitle}</div>}
        </div>
        {onCopy && <button onClick={onCopy} style={iconBtnDark} aria-label="Copy"><Copy size={16} /></button>}
        {onSearch && <button onClick={onSearch} style={iconBtnDark} aria-label="Search"><Search size={17} /></button>}
        {onDownload && <button onClick={onDownload} style={iconBtnDark} aria-label="Download PDF"><Download size={17} /></button>}
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ position: "absolute", left: 12, right: 12, bottom: 14, background: "#000", color: "#fff", fontSize: 12.5, padding: "10px 12px", borderRadius: 6, zIndex: 50, display: "flex", alignItems: "center", gap: 8 }}>
      <AlertTriangle size={14} /> {msg}
    </div>
  );
}

function NumField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid #000", borderRadius: 4, overflow: "hidden" }}>
      <input type="number" inputMode="decimal" value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        style={{ width: 62, border: "none", padding: "6px 6px", textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 700, outline: "none" }} />
      <span style={{ fontFamily: "monospace", fontSize: 11, padding: "0 8px 0 4px", color: "#555", borderLeft: "1px solid #ccc" }}>kg</span>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 12.5 }}>Loading…</div>;
}

/* ================= Home ================= */

function Home({ push }: { push: (s: Screen) => void }) {
  return (
    <div>
      <TopBar title="Alliance Polysacks" subtitle="RP PLANT · DAILY REPORTING" />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {(["oldRp", "newRp"] as const).map((p) => (
          <button key={p} onClick={() => push({ name: "dateList", plant: p })} style={cardRow}>
            <div style={iconBox}><Factory size={18} /></div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{PLANT_LABEL[p]}</div>
              <div style={{ fontSize: 11.5, color: "#666" }}>Wastage & production entries</div>
            </div>
            <ChevronRight size={18} color="#999" />
          </button>
        ))}
        <button onClick={() => push({ name: "dateList", plant: "granules" })} style={cardRow}>
          <div style={iconBox}><Boxes size={18} /></div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Granules Issue</div>
            <div style={{ fontSize: 11.5, color: "#666" }}>Daily material issued</div>
          </div>
          <ChevronRight size={18} color="#999" />
        </button>

        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#888", margin: "10px 0 0" }}>Reports</div>

        <button onClick={() => push({ name: "wastageReportSetup" })} style={cardRow}>
          <div style={iconBox}><FileText size={18} /></div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Wastage Report</div>
            <div style={{ fontSize: 11.5, color: "#666" }}>Month-wise, plant-wise sheet</div>
          </div>
          <ChevronRight size={18} color="#999" />
        </button>
        <button onClick={() => push({ name: "adminPasscode" })} style={cardRow}>
          <div style={iconBox}><BarChart3 size={18} /></div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Admin Report</div>
            <div style={{ fontSize: 11.5, color: "#666" }}>Owner-level · value & balance</div>
          </div>
          <Lock size={15} color="#999" style={{ marginRight: 2 }} />
          <ChevronRight size={18} color="#999" />
        </button>
      </div>
    </div>
  );
}

/* ================= Date List ================= */

function DateList({ plant, push, pop, flash }: { plant: PlantKey | "granules"; push: (s: Screen) => void; pop: () => void; flash: (m: string) => void }) {
  const isGranules = plant === "granules";
  const label = isGranules ? "Granules Issue" : PLANT_LABEL[plant];
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState("");
  const [dupError, setDupError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = isGranules ? await api.listGranuleDates() : await api.listDatesForPlant(plant as PlantKey);
    setDates(result);
    setLoading(false);
  };
  useEffect(() => { load(); }, [plant]);

  const filtered = dates.filter((d) => (!from || d >= from) && (!to || d <= to));

  const confirm = async () => {
    if (!pickedDate) return;
    setBusy(true);
    try {
      const exists = isGranules ? await api.granuleDateExists(pickedDate) : await api.dateEntryExists(plant as PlantKey, pickedDate);
      if (exists) { setDupError(true); setBusy(false); return; }
      if (isGranules) await api.createBlankGranuleEntry(pickedDate);
      else await api.createBlankDateEntry(plant as PlantKey, pickedDate);
      setModalOpen(false); setPickedDate(""); setDupError(false);
      push(isGranules ? { name: "granulesEntry", date: pickedDate } : { name: "dateDetail", plant: plant as PlantKey, date: pickedDate });
    } catch (e: any) {
      flash(e.message || "Couldn't create entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "relative", minHeight: 420 }}>
      <TopBar title={label} onBack={pop} onSearch={() => setShowSearch((s) => !s)} />
      <div style={{ padding: 14 }}>
        {showSearch && (
          <div style={{ border: "1px solid #000", borderRadius: 8, padding: 10, marginBottom: 12, background: "#fafafa" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#555", marginBottom: 6, textTransform: "uppercase" }}>Search by date range</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} />
            </div>
          </div>
        )}

        <button onClick={() => { setModalOpen(true); setPickedDate(""); setDupError(false); }} style={addBtn}>
          <Plus size={16} /> Add new date entry
        </button>

        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#888", margin: "16px 0 8px", textTransform: "uppercase" }}>
          {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
        </div>

        {loading ? <Loading /> : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", fontSize: 12.5, padding: "24px 0" }}>No dates match this range.</div>
        ) : filtered.map((d) => (
          <div key={d} style={{ ...cardRow, cursor: "pointer" }}
            onClick={() => push(isGranules ? { name: "granulesEntry", date: d } : { name: "dateDetail", plant: plant as PlantKey, date: d })}>
            <div style={iconBox}><Calendar size={16} /></div>
            <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "monospace" }}>{d}</div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase" }}>New date entry</div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 11.5, color: "#666", marginBottom: 6 }}>Select the report date. Nothing loads until a date is chosen.</div>
            <input type="date" value={pickedDate} onChange={(e) => { setPickedDate(e.target.value); setDupError(false); }} style={{ ...dateInput, width: "100%" }} />
            {dupError && (
              <div style={{ marginTop: 10, display: "flex", gap: 6, background: "#f4f4f4", border: "1px solid #000", borderRadius: 6, padding: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11.5 }}>Entry for this date already exists. Open it from the list instead.</div>
              </div>
            )}
            <button onClick={confirm} disabled={!pickedDate || busy} style={{ ...primaryBtn, marginTop: 14, opacity: !pickedDate || busy ? 0.5 : 1 }}>
              {busy ? "Checking…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Date Detail ================= */

function DateDetail({ plant, date, push, pop }: { plant: PlantKey; date: string; push: (s: Screen) => void; pop: () => void }) {
  const [wastageSaved, setWastageSaved] = useState(false);
  const [productionSaved, setProductionSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getWastageEntry(plant, date), api.getProductionEntry(plant, date)]).then(([w, p]) => {
      setWastageSaved(!!w?.saved); setProductionSaved(!!p?.saved); setLoading(false);
    });
  }, [plant, date]);

  return (
    <div>
      <TopBar title={PLANT_LABEL[plant]} subtitle={date} onBack={pop} />
      {loading ? <Loading /> : (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => push({ name: "wastageEntry", plant, date })} style={cardRow}>
            <div style={iconBox}><ClipboardList size={17} /></div>
            <div style={{ flex: 1, textAlign: "left", fontWeight: 700, fontSize: 14 }}>Wastage report</div>
            {wastageSaved && <Stamp />}
          </button>
          <button onClick={() => push({ name: "productionEntry", plant, date })} style={cardRow}>
            <div style={iconBox}><Package size={17} /></div>
            <div style={{ flex: 1, textAlign: "left", fontWeight: 700, fontSize: 14 }}>Production report</div>
            {productionSaved && <Stamp />}
          </button>
        </div>
      )}
    </div>
  );
}

function Stamp() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1.5px solid #000", borderRadius: 3, padding: "2px 7px", fontFamily: "monospace", fontSize: 10, fontWeight: 700, transform: "rotate(-4deg)" }}>
      <Check size={11} /> LOGGED
    </span>
  );
}

/* ================= Wastage Entry ================= */

function WastageEntry({ plant, date, pop, flash, copyToClipboard }: {
  plant: PlantKey; date: string; pop: () => void; flash: (m: string) => void; copyToClipboard: (t: string) => void;
}) {
  const schema = WASTAGE_SCHEMA[plant];
  const [values, setValues] = useState<WastageValues>(emptyWastageValues(plant));
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(schema[0].name);
  const [addingIn, setAddingIn] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getWastageEntry(plant, date).then((e) => {
      if (e) { setValues(e.values); setNotes(e.notes); }
      setLoading(false);
    });
  }, [plant, date]);

  const total = Object.values(values).reduce((s, dep) => s + Object.values(dep).reduce((a, b) => a + (Number(b) || 0), 0), 0);

  const setItem = (dep: string, item: string, val: string) =>
    setValues((p) => ({ ...p, [dep]: { ...p[dep], [item]: val === "" ? 0 : Number(val) } }));
  const addCustomItem = (dep: string) => {
    const name = newItemName.trim();
    if (!name) return;
    setValues((p) => ({ ...p, [dep]: { ...p[dep], [name]: 0 } }));
    setNewItemName(""); setAddingIn("");
  };
  const removeItem = (dep: string, item: string) =>
    setValues((p) => { const c = { ...p[dep] }; delete c[item]; return { ...p, [dep]: c }; });

  const onCopy = () => copyToClipboard(buildWastageMessage(PLANT_LABEL[plant], date, schema, values, notes, total));
  const onSave = async () => {
    setSaving(true);
    try {
      await api.saveWastageEntry({ plant, date, values, notes, saved: true });
      flash("Wastage report saved ✓");
      pop();
    } catch (e: any) {
      flash(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div><TopBar title="Wastage report" onBack={pop} /><Loading /></div>;

  return (
    <div>
      <TopBar title="Wastage report" subtitle={`${PLANT_LABEL[plant]} · ${date}`} onBack={pop} onCopy={total > 0 ? onCopy : undefined} />
      <div style={{ padding: 14 }}>
        <div style={totalBanner}><span>Total wastage</span><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15 }}>{fmt(total)} kg</span></div>

        {schema.map((dep) => {
          const isOpen = open === dep.name;
          const depTotal = Object.values(values[dep.name] || {}).reduce((a, b) => a + (Number(b) || 0), 0);
          const customKeys = Object.keys(values[dep.name] || {}).filter((k) => !dep.items.includes(k));
          return (
            <div key={dep.name} style={{ border: "1px solid #000", borderRadius: 8, marginTop: 10, overflow: "hidden" }}>
              <button onClick={() => setOpen(isOpen ? "" : dep.name)} style={accordionHead}>
                <span style={{ fontWeight: 700, fontSize: 12.5, textTransform: "uppercase" }}>{dep.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{fmt(depTotal)} kg</span>
                  <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "4px 12px 12px" }}>
                  {dep.items.map((item) => (
                    <div key={item} style={itemRow}>
                      <span style={{ fontSize: 12.5 }}>{item}</span>
                      <NumField value={values[dep.name]?.[item] ?? 0} onChange={(v) => setItem(dep.name, item, String(v))} />
                    </div>
                  ))}
                  {customKeys.map((item) => (
                    <div key={item} style={itemRow}>
                      <span style={{ fontSize: 12.5 }}>{item}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <NumField value={values[dep.name]?.[item] ?? 0} onChange={(v) => setItem(dep.name, item, String(v))} />
                        <button onClick={() => removeItem(dep.name, item)} style={smallIconBtn}><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {addingIn === dep.name ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <input autoFocus value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="New wastage item name" style={textRowInput}
                        onKeyDown={(e) => e.key === "Enter" && addCustomItem(dep.name)} />
                      <button onClick={() => addCustomItem(dep.name)} style={smallIconBtn}><Check size={14} /></button>
                      <button onClick={() => { setAddingIn(""); setNewItemName(""); }} style={smallIconBtn}><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingIn(dep.name)} style={addBtnGhost}><Plus size={14} /> Add wastage item</button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 16 }}>
          <div style={notesLabel}>Notes (optional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remark for this report..." style={textarea} />
        </div>

        <button onClick={onSave} disabled={saving} style={{ ...primaryBtn, marginTop: 16, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save wastage report"}
        </button>
      </div>
    </div>
  );
}

/* ================= Production Entry ================= */

function ProductionEntry({ plant, date, pop, flash, copyToClipboard }: {
  plant: PlantKey; date: string; pop: () => void; flash: (m: string) => void; copyToClipboard: (t: string) => void;
}) {
  const [shift, setShift] = useState<"A" | "B">("A");
  const [shiftA, setShiftA] = useState<ShiftData>({ rows: [], lumps: 0, stopped: false });
  const [shiftB, setShiftB] = useState<ShiftData>({ rows: [], lumps: 0, stopped: false });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProductionEntry(plant, date).then((e) => {
      if (e) { setShiftA(e.shift_a); setShiftB(e.shift_b); setNotes(e.notes); }
      setLoading(false);
    });
  }, [plant, date]);

  const data = shift === "A" ? shiftA : shiftB;
  const setData = shift === "A" ? setShiftA : setShiftB;
  const shiftTotal = data.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const grandTotal = shiftA.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0) + shiftB.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const addRow = () => setData((d) => ({ ...d, rows: [...d.rows, { id: uid(), name: "", qty: 0 }] }));
  const updRow = (id: string, patch: Partial<ProductionRow>) => setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const delRow = (id: string) => setData((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));

  const onCopy = () => copyToClipboard(buildProductionMessage(PLANT_LABEL[plant], date, shiftA, shiftB, notes));
  const onSave = async () => {
    setSaving(true);
    try {
      await api.saveProductionEntry({ plant, date, shift_a: shiftA, shift_b: shiftB, notes, saved: true });
      flash("Production report saved ✓");
      pop();
    } catch (e: any) {
      flash(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div><TopBar title="Production report" onBack={pop} /><Loading /></div>;

  return (
    <div>
      <TopBar title="Production report" subtitle={`${PLANT_LABEL[plant]} · ${date}`} onBack={pop} onCopy={grandTotal > 0 ? onCopy : undefined} />
      <div style={{ padding: 14 }}>
        <div style={totalBanner}><span>Total production (both shifts)</span><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15 }}>{fmt(grandTotal)} kg</span></div>

        <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
          {(["A", "B"] as const).map((s) => (
            <button key={s} onClick={() => setShift(s)} style={{ ...shiftTab, ...(shift === s ? shiftTabActive : {}) }}>Shift {s}</button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 12 }}>
          <input type="checkbox" checked={data.stopped} onChange={(e) => setData((d) => ({ ...d, stopped: e.target.checked }))} />
          Plant stopped this shift
        </label>

        {!data.stopped && (
          <>
            <div style={notesLabel}>Granule type</div>
            {data.rows.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <input value={r.name} onChange={(e) => updRow(r.id, { name: e.target.value })} placeholder="e.g. JK Pro" style={textRowInput} />
                <NumField value={r.qty} onChange={(v) => updRow(r.id, { qty: v })} />
                <button onClick={() => delRow(r.id)} style={smallIconBtn}><X size={14} /></button>
              </div>
            ))}
            <button onClick={addRow} style={addBtnGhost}><Plus size={14} /> Add granule type</button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "1px dashed #999" }}>
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>Lumps</span>
              <NumField value={data.lumps} onChange={(v) => setData((d) => ({ ...d, lumps: v }))} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12.5 }}>
              <span style={{ color: "#666" }}>Shift {shift} production</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(shiftTotal)} kg</span>
            </div>
          </>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={notesLabel}>Notes (optional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remark..." style={textarea} />
        </div>

        <button onClick={onSave} disabled={saving} style={{ ...primaryBtn, marginTop: 16, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save production report"}
        </button>
      </div>
    </div>
  );
}

/* ================= Granules Entry ================= */

function GranulesEntry({ date, pop, flash, copyToClipboard }: { date: string; pop: () => void; flash: (m: string) => void; copyToClipboard: (t: string) => void }) {
  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getGranuleEntry(date).then((e) => {
      if (e) { setRows(e.rows); setNotes(e.notes); }
      setLoading(false);
    });
  }, [date]);

  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const addRow = () => setRows((r) => [...r, { id: uid(), name: "", qty: 0 }]);
  const updRow = (id: string, patch: Partial<ProductionRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));

  const onCopy = () => copyToClipboard(buildGranulesMessage(date, rows, notes, total));
  const onSave = async () => {
    setSaving(true);
    try {
      await api.saveGranuleEntry({ date, rows, notes, saved: true });
      flash("Granules issue saved ✓");
      pop();
    } catch (e: any) {
      flash(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div><TopBar title="Granules issue" onBack={pop} /><Loading /></div>;

  return (
    <div>
      <TopBar title="Granules issue" subtitle={date} onBack={pop} onCopy={total > 0 ? onCopy : undefined} />
      <div style={{ padding: 14 }}>
        <div style={totalBanner}><span>Total granules issued</span><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15 }}>{fmt(total)} kg</span></div>

        <div style={notesLabel}>Material issued</div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <input value={r.name} onChange={(e) => updRow(r.id, { name: e.target.value })} placeholder="e.g. White Dana" style={textRowInput} />
            <NumField value={r.qty} onChange={(v) => updRow(r.id, { qty: v })} />
            <button onClick={() => delRow(r.id)} style={smallIconBtn}><X size={14} /></button>
          </div>
        ))}
        <button onClick={addRow} style={addBtnGhost}><Plus size={14} /> Add material</button>

        <div style={{ marginTop: 18 }}>
          <div style={notesLabel}>Notes (optional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remark..." style={textarea} />
        </div>

        <button onClick={onSave} disabled={saving} style={{ ...primaryBtn, marginTop: 16, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save entry"}
        </button>
      </div>
    </div>
  );
}

/* ================= Wastage Report ================= */

function WastageReportSetup({ push, pop }: { push: (s: Screen) => void; pop: () => void }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  return (
    <div>
      <TopBar title="Wastage report" onBack={pop} />
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 11.5, color: "#666", marginBottom: 14 }}>
          Pick the month to generate a department-wise wastage sheet — separate for Old and New RP Plant.
        </div>
        <div style={notesLabel}>Month</div>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <div style={{ ...notesLabel, marginTop: 14 }}>Year</div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => push({ name: "wastageReportSheet", year, month, plant: "oldRp" })} style={{ ...primaryBtn, marginTop: 20 }}>
          Generate sheet
        </button>
      </div>
    </div>
  );
}

function WastageReportSheet({ year, month, plant: initialPlant, pop }: { year: number; month: number; plant: PlantKey; pop: () => void }) {
  const [plant, setPlant] = useState(initialPlant);
  const [rows, setRows] = useState<{ date: string; deptTotals: number[]; rowTotal: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const schema = WASTAGE_SCHEMA[plant];
  const deptNames = schema.map((d) => d.name);
  const monthLabel = MONTHS[month - 1];

  useEffect(() => {
    setLoading(true);
    api.getWastageMonth(plant, year, month).then((data) => {
      setRows(data.map(({ date, entry }) => {
        const deptTotals = schema.map((dep) => Object.values(entry?.values?.[dep.name] || {}).reduce((s, v) => s + (Number(v) || 0), 0));
        return { date, deptTotals, rowTotal: deptTotals.reduce((a, b) => a + b, 0) };
      }));
      setLoading(false);
    });
  }, [plant, year, month]);

  const grandTotal = rows.reduce((s, r) => s + r.rowTotal, 0);

  return (
    <div>
      <TopBar title="Wastage report" subtitle={`${monthLabel} ${year}`} onBack={pop}
        onDownload={() => downloadWastagePdf(PLANT_LABEL[plant], monthLabel, year, schema, rows)} />
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["oldRp", "newRp"] as const).map((p) => (
            <button key={p} onClick={() => setPlant(p)} style={{ ...shiftTab, ...(plant === p ? shiftTabActive : {}) }}>{PLANT_LABEL[p]}</button>
          ))}
        </div>
        <div style={summaryBox}>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>{PLANT_LABEL[plant]} — Wastage — {monthLabel} {year}</div>
          <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace", marginTop: 2 }}>Month total {fmt(grandTotal)} kg</div>
        </div>

        {loading ? <Loading /> : (
          <div style={{ overflowX: "auto", border: "1px solid #000", borderRadius: 8, marginTop: 10 }}>
            <table style={{ borderCollapse: "collapse", minWidth: 120 + deptNames.length * 84 + 90 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, position: "sticky", left: 0, background: "#000", minWidth: 78 }}>Date</th>
                  {deptNames.map((d) => <th key={d} style={{ ...thStyle, minWidth: 84 }}>{d}</th>)}
                  <th style={{ ...thStyle, minWidth: 90, background: "#222" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.date} style={{ background: i % 2 ? "#f7f7f5" : "#fff" }}>
                    <td style={{ ...tdStyle, position: "sticky", left: 0, background: i % 2 ? "#f7f7f5" : "#fff", fontWeight: 700 }}>{r.date.slice(8)}</td>
                    {r.deptTotals.map((v, di) => <td key={di} style={tdStyle}>{fmt(v)}</td>)}
                    <td style={{ ...tdStyle, fontWeight: 700, background: "#f0efe9" }}>{fmt(r.rowTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= Admin ================= */

function AdminPasscode({ push, pop }: { push: (s: Screen) => void; pop: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    try {
      const ok = await verifyAdminPasscode(code);
      if (ok) push({ name: "adminReport", passcode: code });
      else setError("Incorrect passcode. Try again.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <TopBar title="Admin report" onBack={pop} />
      <div style={{ padding: 28, textAlign: "center" }}>
        <div style={{ width: 46, height: 46, border: "1.5px solid #000", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Lock size={20} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>This report is protected</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 18 }}>Enter the 6-digit admin passcode to continue.</div>
        <input
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="numeric" maxLength={6} placeholder="••••••"
          style={{ width: 160, textAlign: "center", letterSpacing: "0.5em", fontSize: 20, fontWeight: 700, fontFamily: "monospace", border: "1.5px solid #000", borderRadius: 8, padding: "10px 0" }}
        />
        {error && <div style={{ marginTop: 10, fontSize: 12, color: "#a30000" }}>{error}</div>}
        <button onClick={submit} disabled={checking || code.length !== 6} style={{ ...primaryBtn, marginTop: 20, width: 160, opacity: checking || code.length !== 6 ? 0.5 : 1 }}>
          {checking ? "Checking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}

function AdminReport({ passcode, push, pop }: { passcode: string; push: (s: Screen) => void; pop: () => void }) {
  const [plant, setPlant] = useState<PlantKey>("oldRp");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Awaited<ReturnType<typeof getAdminReport>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getAdminReport(passcode, plant, year, month)
      .then((r) => { setReport(r); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [plant, month, year]);

  return (
    <div>
      <TopBar title="Admin report" subtitle={`${MONTHS[month - 1]} ${year}`} onBack={pop}
        onDownload={report ? () => downloadAdminPdf(PLANT_LABEL[plant], MONTHS[month - 1], year, report.rows, report.overall, report.rate, report.dedBoth, report.dedOne) : undefined} />
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["oldRp", "newRp"] as const).map((p) => (
            <button key={p} onClick={() => setPlant(p)} style={{ ...shiftTab, ...(plant === p ? shiftTabActive : {}) }}>{PLANT_LABEL[p]}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ ...selectStyle, flex: 1 }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...selectStyle, flex: 1 }}>
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {error && <div style={{ fontSize: 12, color: "#a30000", marginBottom: 12 }}>{error}</div>}
        {loading ? <Loading /> : report && (
          <>
            <div style={summaryBox}>
              <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>{PLANT_LABEL[plant]} — Admin — {MONTHS[month - 1]} {year}</div>
              <div style={{ fontSize: 10.5, color: "#666", fontFamily: "monospace", marginTop: 2 }}>
                Rate {report.rate.toFixed(2)}/kg · Both shifts {fmt(report.dedBoth)} · One shift {fmt(report.dedOne)}
              </div>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #000", borderRadius: 8, marginTop: 10 }}>
              <table style={{ borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: "sticky", left: 0, background: "#000", minWidth: 74 }}>Date</th>
                    <th style={{ ...thStyle, minWidth: 82 }}>Shift A</th>
                    <th style={{ ...thStyle, minWidth: 82 }}>Shift B</th>
                    <th style={{ ...thStyle, minWidth: 100 }}>Total Prod.</th>
                    <th style={{ ...thStyle, minWidth: 110 }}>Total Amount</th>
                    <th style={{ ...thStyle, minWidth: 100, background: "#222" }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={r.day} style={{ background: i % 2 ? "#f7f7f5" : "#fff" }}>
                      <td style={{ ...tdStyle, position: "sticky", left: 0, background: i % 2 ? "#f7f7f5" : "#fff", fontWeight: 700 }}>{pad2(r.day)}-{MONTHS[month - 1].slice(0, 3)}</td>
                      <td style={tdStyle}>{r.shiftA === null ? "—" : fmt(r.shiftA)}</td>
                      <td style={tdStyle}>{r.shiftB === null ? "—" : fmt(r.shiftB)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(r.totalProduction)}</td>
                      <td style={tdStyle}>{fmtMoney(r.totalAmount)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, background: "#f0efe9" }}>{fmtMoney(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ border: "1.5px solid #000", borderRadius: 8, marginTop: 14, overflow: "hidden" }}>
              <div style={{ background: "#000", color: "#fff", padding: 10, fontWeight: 700, fontSize: 11.5, textTransform: "uppercase" }}>Overall total</div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Total production" value={`${fmt(report.overall.production)} kg`} />
                <Row label="Total amount" value={`₹ ${fmtMoney(report.overall.amount)}`} />
                <Row label="Total balance" value={`₹ ${fmtMoney(report.overall.balance)}`} />
              </div>
            </div>
          </>
        )}

        <button onClick={() => push({ name: "adminSettings", passcode })} style={{ ...addBtnGhost, width: "100%", justifyContent: "center", marginTop: 16, marginBottom: 30 }}>
          Calculation & password settings
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#666" }}>{label}</span><span style={{ fontWeight: 700, fontFamily: "monospace" }}>{value}</span></div>;
}

function AdminSettings({ passcode, pop, flash }: { passcode: string; pop: () => void; flash: (m: string) => void }) {
  const [oldRate, setOldRate] = useState("2.10");
  const [oldDed, setOldDed] = useState("4025");
  const [newRate, setNewRate] = useState("2.75");
  const [newDed, setNewDed] = useState("3760");
  const [calcPass, setCalcPass] = useState(passcode);

  const [curPass, setCurPass] = useState(passcode);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [err, setErr] = useState("");

  const saveCalc = async () => {
    try {
      await updateAdminSettings({
        currentPasscode: calcPass,
        oldRp: { rate: Number(oldRate) || 0, dedBoth: Number(oldDed) || 0 },
        newRp: { rate: Number(newRate) || 0, dedBoth: Number(newDed) || 0 },
      });
      flash("Calculation rules updated ✓");
    } catch (e: any) { setErr(e.message); }
  };

  const savePassword = async () => {
    if (newPass.length !== 6) { setErr("New password must be exactly 6 digits."); return; }
    if (newPass !== confirmPass) { setErr("New password and confirm password don't match."); return; }
    try {
      await updateAdminSettings({ currentPasscode: curPass, newPasscode: newPass });
      setErr(""); setCurPass(newPass); setNewPass(""); setConfirmPass("");
      flash("Password changed ✓");
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <div>
      <TopBar title="Admin settings" onBack={pop} />
      <div style={{ padding: 14 }}>
        <div style={{ ...notesLabel, marginBottom: 8 }}>Calculation rules</div>

        <div style={plantBox}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Old RP Plant</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><div style={notesLabel}>Rate</div><input value={oldRate} onChange={(e) => setOldRate(e.target.value)} style={settingsInput} /></div>
            <div style={{ flex: 1 }}><div style={notesLabel}>Deduction (both shifts)</div><input value={oldDed} onChange={(e) => setOldDed(e.target.value)} style={settingsInput} /></div>
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>One-shift deduction (auto = half): {fmt(Number(oldDed) / 2)}</div>
        </div>

        <div style={plantBox}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>New RP Plant</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><div style={notesLabel}>Rate</div><input value={newRate} onChange={(e) => setNewRate(e.target.value)} style={settingsInput} /></div>
            <div style={{ flex: 1 }}><div style={notesLabel}>Deduction (both shifts)</div><input value={newDed} onChange={(e) => setNewDed(e.target.value)} style={settingsInput} /></div>
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>One-shift deduction (auto = half): {fmt(Number(newDed) / 2)}</div>
        </div>

        <div style={notesLabel}>Current admin password (to confirm this change)</div>
        <input value={calcPass} onChange={(e) => setCalcPass(e.target.value)} maxLength={6} style={{ ...settingsInput, width: "100%", marginBottom: 12 }} />
        <button onClick={saveCalc} style={primaryBtn}>Save calculation rules</button>

        <div style={{ borderTop: "1px dashed #999", margin: "22px 0 16px" }} />

        <div style={{ ...notesLabel, marginBottom: 8 }}>Change admin password</div>
        <div style={{ fontSize: 11.5, color: "#666", marginBottom: 10 }}>Enter your current 6-digit password, then set a new one.</div>
        <div style={notesLabel}>Current password</div>
        <input value={curPass} onChange={(e) => setCurPass(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} style={{ ...settingsInput, width: "100%", marginBottom: 10 }} />
        <div style={notesLabel}>New password (6 digits)</div>
        <input value={newPass} onChange={(e) => setNewPass(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} style={{ ...settingsInput, width: "100%", marginBottom: 10 }} />
        <div style={notesLabel}>Confirm new password</div>
        <input value={confirmPass} onChange={(e) => setConfirmPass(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} style={{ ...settingsInput, width: "100%", marginBottom: 10 }} />
        {err && <div style={{ fontSize: 11.5, color: "#a30000", marginBottom: 10 }}>{err}</div>}
        <button onClick={savePassword} style={{ ...primaryBtn, marginBottom: 30 }}>Save new password</button>
      </div>
    </div>
  );
}

/* ================= styles ================= */

const iconBtnDark: React.CSSProperties = { background: "transparent", border: "1px solid #444", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" };
const cardRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", border: "1px solid #000", borderRadius: 10, padding: "10px 12px", background: "#fff", textAlign: "left", cursor: "pointer" };
const iconBox: React.CSSProperties = { width: 38, height: 38, border: "1.5px solid #000", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const smallIconBtn: React.CSSProperties = { width: 28, height: 28, border: "1px solid #000", borderRadius: 6, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const addBtn: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#000", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const addBtnGhost: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px dashed #000", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, marginTop: 10, cursor: "pointer" };
const primaryBtn: React.CSSProperties = { width: "100%", background: "#000", color: "#fff", border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer" };
const dateInput: React.CSSProperties = { flex: 1, border: "1px solid #000", borderRadius: 6, padding: "8px 8px", fontSize: 12.5, fontFamily: "monospace" };
const selectStyle: React.CSSProperties = { width: "100%", border: "1px solid #000", borderRadius: 8, padding: "10px 10px", fontSize: 13, fontWeight: 700, background: "#fff" };
const totalBanner: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1.5px solid #000", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", background: "#f6f6f4" };
const accordionHead: React.CSSProperties = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", background: "#000", color: "#fff", border: "none", cursor: "pointer" };
const textarea: React.CSSProperties = { width: "100%", minHeight: 60, border: "1px solid #000", borderRadius: 8, padding: 10, fontSize: 12.5, resize: "vertical", fontFamily: "system-ui" };
const textRowInput: React.CSSProperties = { flex: 1, border: "1px solid #000", borderRadius: 6, padding: "7px 8px", fontSize: 12.5 };
const shiftTab: React.CSSProperties = { flex: 1, padding: "9px 0", border: "1px solid #000", borderRadius: 6, background: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const shiftTabActive: React.CSSProperties = { background: "#000", color: "#fff" };
const overlay: React.CSSProperties = { position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, display: "flex", alignItems: "flex-end" };
const modalBox: React.CSSProperties = { width: "100%", background: "#fff", borderRadius: "16px 16px 0 0", padding: 18, borderTop: "2px solid #000" };
const thStyle: React.CSSProperties = { background: "#000", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "8px 8px", textAlign: "right", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { fontSize: 11.5, fontFamily: "monospace", padding: "7px 8px", textAlign: "right", borderBottom: "1px solid #e5e5e5", whiteSpace: "nowrap" };
const itemRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #eee" };
const notesLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 };
const summaryBox: React.CSSProperties = { border: "1.5px solid #000", borderRadius: 8, padding: "10px 14px", background: "#f6f6f4" };
const plantBox: React.CSSProperties = { border: "1px solid #000", borderRadius: 8, padding: 12, marginBottom: 10 };
const settingsInput: React.CSSProperties = { width: "100%", border: "1px solid #000", borderRadius: 6, padding: "8px 8px", fontSize: 13, fontWeight: 700 };
