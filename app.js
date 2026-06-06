import { useState, useEffect, useCallback } from "react";

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: "pharm", name: "Pharmacology", short: "Pharm", color: "#6366f1" },
  { id: "path", name: "Pathology", short: "Path", color: "#ec4899" },
  { id: "anatomy", name: "Anatomy", short: "Anat", color: "#f59e0b" },
  { id: "physio", name: "Physiology", short: "Physio", color: "#10b981" },
  { id: "biochem", name: "Biochemistry", short: "BioChem", color: "#38bdf8" },
];

const TIMETABLE = {
  1: [ // Monday
    { time: "09:00", subjectId: "pharm" },
    { time: "11:00", subjectId: "path" },
    { time: "14:00", subjectId: "anatomy" },
  ],
  2: [ // Tuesday
    { time: "09:00", subjectId: "physio" },
    { time: "11:00", subjectId: "biochem" },
  ],
  3: [ // Wednesday
    { time: "09:00", subjectId: "pharm" },
    { time: "11:00", subjectId: "anatomy" },
    { time: "14:00", subjectId: "physio" },
  ],
  4: [ // Thursday
    { time: "10:00", subjectId: "path" },
    { time: "13:00", subjectId: "biochem" },
  ],
  5: [ // Friday
    { time: "09:00", subjectId: "pharm" },
    { time: "11:00", subjectId: "physio" },
  ],
};

function getMonthDays(year, month) {
  const days = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildInitialAttendance() {
  const rec = {};
  const today = new Date();
  for (let i = 60; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay(); // 0=Sun
    if (dow === 0 || dow === 6) continue;
    const classes = TIMETABLE[dow] || [];
    if (!classes.length) continue;
    const dk = dateKey(d);
    rec[dk] = {};
    classes.forEach(({ subjectId }) => {
      if (i === 0) {
        rec[dk][subjectId] = null; // today: unmarked
      } else {
        rec[dk][subjectId] = Math.random() > 0.22 ? "present" : "absent";
      }
    });
  }
  return rec;
}

const HOLIDAYS = new Set(["2026-01-26", "2026-05-01", "2026-05-25"]);

// ─── Stat Helpers ─────────────────────────────────────────────────────────────
function subjectStats(subjectId, attendance, holidays) {
  let total = 0, present = 0;
  Object.entries(attendance).forEach(([dk, classes]) => {
    if (holidays.has(dk)) return;
    if (classes[subjectId] === "present") { total++; present++; }
    else if (classes[subjectId] === "absent") total++;
  });
  return { total, present, pct: total ? Math.round((present / total) * 100) : 100 };
}

function overallStats(attendance, holidays) {
  let total = 0, present = 0;
  Object.entries(attendance).forEach(([dk, classes]) => {
    if (holidays.has(dk)) return;
    Object.values(classes).forEach(v => {
      if (v === "present") { total++; present++; }
      else if (v === "absent") total++;
    });
  });
  return { total, present, pct: total ? Math.round((present / total) * 100) : 100 };
}

function safeBunk(subjectId, attendance, holidays, threshold = 75) {
  const { total, present } = subjectStats(subjectId, attendance, holidays);
  // present / (total + n) >= threshold/100  => n <= (present*100/threshold - total)
  const maxTotal = Math.floor((present * 100) / threshold);
  const canMiss = Math.max(0, maxTotal - total);
  return canMiss;
}

function needToAttend(subjectId, attendance, holidays, target = 80) {
  const { total, present } = subjectStats(subjectId, attendance, holidays);
  // (present + n) / (total + n) >= target/100
  // present + n >= (target/100)(total + n)
  // present + n >= target*total/100 + target*n/100
  // n(1 - target/100) >= target*total/100 - present
  const t = target / 100;
  if (present / total >= t) return 0;
  const n = Math.ceil((t * total - present) / (1 - t));
  return Math.max(0, n);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Home: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Calendar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  BookOpen: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  BarChart: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Settings: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  AlertTriangle: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Undo: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 13 4 10"/></svg>,
  X: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  TrendUp: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Sun: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  ChevronLeft: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevronRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Bell: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DoneApp() {
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState("home");
  const [attendance, setAttendance] = useState(() => buildInitialAttendance());
  const [holidays, setHolidays] = useState(() => new Set(HOLIDAYS));
  const [snackbar, setSnackbar] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [calSelected, setCalSelected] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const today = new Date();
  const todayKey = dateKey(today);
  const todayDow = today.getDay();
  const todayClasses = TIMETABLE[todayDow] || [];

  const overall = overallStats(attendance, holidays);

  const showSnack = (msg, undoable = false) => {
    setSnackbar({ msg, undoable, id: Date.now() });
    setTimeout(() => setSnackbar(null), 4000);
  };

  const mark = (dk, subjectId, status) => {
    const prev = attendance[dk]?.[subjectId];
    setLastAction({ dk, subjectId, prev });
    setAttendance(a => ({
      ...a,
      [dk]: { ...(a[dk] || {}), [subjectId]: status }
    }));
    showSnack(`Marked ${status === "present" ? "✅ Present" : "❌ Absent"}`, true);
  };

  const undo = () => {
    if (!lastAction) return;
    const { dk, subjectId, prev } = lastAction;
    setAttendance(a => ({
      ...a,
      [dk]: { ...(a[dk] || {}), [subjectId]: prev }
    }));
    setLastAction(null);
    setSnackbar(null);
    showSnack("↩ Undone");
  };

  const toggleHoliday = (dk) => {
    setHolidays(h => {
      const n = new Set(h);
      n.has(dk) ? n.delete(dk) : n.add(dk);
      return n;
    });
  };

  const d = dark;
  const bg = d ? "#0B1120" : "#F1F5F9";
  const card = d ? "#151E30" : "#FFFFFF";
  const card2 = d ? "#1A2540" : "#F8FAFC";
  const border = d ? "#1E2D45" : "#E2E8F0";
  const text = d ? "#E2E8F0" : "#1E293B";
  const sub = d ? "#64748B" : "#94A3B8";
  const accent = "#3B82F6";
  const green = d ? "#34D399" : "#10B981";
  const red = d ? "#F87171" : "#EF4444";
  const amber = "#F59E0B";

  const pctColor = (p) => p >= 75 ? green : p >= 60 ? amber : red;

  const s = {
    app: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: bg, color: text, minHeight: "100vh", maxWidth: 430, margin: "0 auto", position: "relative", display: "flex", flexDirection: "column" },
    header: { padding: "16px 20px 12px", background: card, borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 },
    headerTitle: { fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: text },
    pctBadge: { fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: `${accent}22`, color: accent },
    content: { flex: 1, overflowY: "auto", paddingBottom: 80 },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: card, borderTop: `1px solid ${border}`, display: "flex", zIndex: 20 },
    navBtn: (active) => ({ flex: 1, padding: "10px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", border: "none", background: "none", color: active ? accent : sub, fontSize: 10, fontWeight: active ? 700 : 500, transition: "color 0.2s" }),
    navIcon: { width: 22, height: 22 },
    section: { padding: "16px 20px 0" },
    card: (extra = {}) => ({ background: card, borderRadius: 16, border: `1px solid ${border}`, padding: 16, marginBottom: 12, ...extra }),
    subjectRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${border}` },
    pill: (bg, fg = "#fff") => ({ background: bg, color: fg, borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", transition: "opacity 0.15s" }),
    bigPct: { fontSize: 52, fontWeight: 900, letterSpacing: -2, lineHeight: 1 },
    label: { fontSize: 11, fontWeight: 600, color: sub, textTransform: "uppercase", letterSpacing: 0.8 },
    progressBg: { background: border, borderRadius: 6, height: 6, overflow: "hidden", flex: 1 },
    progressFill: (w, c) => ({ width: `${w}%`, background: c, height: "100%", borderRadius: 6, transition: "width 0.4s" }),
    alertCard: { background: `${red}18`, border: `1px solid ${red}44`, borderRadius: 14, padding: "12px 16px", marginBottom: 10 },
    snack: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: d ? "#1E293B" : "#1E293B", color: "#fff", borderRadius: 12, padding: "10px 18px", display: "flex", gap: 12, alignItems: "center", fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: "0 4px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" },
    calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: "0 16px 16px" },
    calDay: (st) => {
      const base = { aspect: "1/1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid transparent", transition: "all 0.15s" };
      if (st === "today") return { ...base, border: `2px solid ${accent}`, background: `${accent}22` };
      if (st === "selected") return { ...base, border: `2px solid ${accent}`, background: accent + "33" };
      return base;
    },
  };

  // ── Home ──
  const HomeTab = () => {
    const alerts = SUBJECTS.filter(s => subjectStats(s.id, attendance, holidays).pct < 75);
    return (
      <div style={s.content}>
        {/* Hero */}
        <div style={{ ...s.card({ margin: "16px 20px 0", background: d ? `linear-gradient(135deg, #151E30, #1A2540)` : `linear-gradient(135deg, #EFF6FF, #DBEAFE)` }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={s.label}>Overall Attendance</div>
              <div style={{ ...s.bigPct, color: pctColor(overall.pct) }}>{overall.pct}<span style={{ fontSize: 24, fontWeight: 700 }}>%</span></div>
              <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>{overall.present}/{overall.total} classes attended</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: sub }}>{today.toDateString()}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: sub }}>
                {overall.pct >= 75 ? <span style={{ color: green }}>✓ On track</span> : <span style={{ color: red }}>⚠ Below 75%</span>}
              </div>
            </div>
          </div>
          {/* Mini bars */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {SUBJECTS.map(subj => {
              const st = subjectStats(subj.id, attendance, holidays);
              return (
                <div key={subj.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: sub, width: 50, flexShrink: 0 }}>{subj.short}</div>
                  <div style={s.progressBg}>
                    <div style={s.progressFill(st.pct, pctColor(st.pct))} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: pctColor(st.pct), width: 34, textAlign: "right" }}>{st.pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ padding: "12px 20px 0" }}>
            {alerts.map(subj => {
              const st = subjectStats(subj.id, attendance, holidays);
              const need = needToAttend(subj.id, attendance, holidays, 75);
              return (
                <div key={subj.id} style={s.alertCard}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: red, width: 18, height: 18, flexShrink: 0 }}><Icon.AlertTriangle /></span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: red }}>{subj.name} — {st.pct}%</div>
                      <div style={{ fontSize: 12, color: sub }}>Attend next {need} class{need !== 1 ? "es" : ""} to reach 75%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Today's classes */}
        <div style={s.section}>
          <div style={s.label}>Today's Classes</div>
          {todayClasses.length === 0 ? (
            <div style={{ ...s.card({ textAlign: "center", color: sub, fontSize: 13, padding: 24 }) }}>No classes scheduled today 🎉</div>
          ) : (
            <div style={s.card()}>
              {todayClasses.map(({ time, subjectId }, i) => {
                const subj = SUBJECTS.find(s => s.id === subjectId);
                const status = attendance[todayKey]?.[subjectId];
                return (
                  <div key={i} style={{ ...s.subjectRow, borderBottom: i < todayClasses.length - 1 ? `1px solid ${border}` : "none" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: subj.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{subj.name}</div>
                        <div style={{ fontSize: 11, color: sub }}>{time}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => mark(todayKey, subjectId, "present")}
                        style={{ ...s.pill(status === "present" ? green : `${green}22`, status === "present" ? "#fff" : green) }}>
                        ✓ Present
                      </button>
                      <button onClick={() => mark(todayKey, subjectId, "absent")}
                        style={{ ...s.pill(status === "absent" ? red : `${red}22`, status === "absent" ? "#fff" : red) }}>
                        ✗ Absent
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ ...s.section, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12 }}>
          {SUBJECTS.slice(0, 2).map(subj => {
            const bunk = safeBunk(subj.id, attendance, holidays, 75);
            const rec = needToAttend(subj.id, attendance, holidays, 80);
            const st = subjectStats(subj.id, attendance, holidays);
            return (
              <div key={subj.id} style={s.card({ padding: 12 })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: subj.color }}>{subj.short}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: pctColor(st.pct), marginTop: 2 }}>{st.pct}%</div>
                <div style={{ fontSize: 11, color: sub, marginTop: 4 }}>
                  {bunk > 0 ? <span style={{ color: green }}>Can miss {bunk} more</span> : <span style={{ color: amber }}>Attend {rec} to reach 80%</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly summary */}
        <div style={{ ...s.section, paddingTop: 4 }}>
          <WeeklySummary attendance={attendance} holidays={holidays} d={d} s={s} sub={sub} border={border} card={card} green={green} />
        </div>
      </div>
    );
  };

  // ── Calendar ──
  const CalendarTab = () => {
    const days = getMonthDays(calMonth.y, calMonth.m);
    const firstDow = new Date(calMonth.y, calMonth.m, 1).getDay();
    const blanks = Array(firstDow).fill(null);

    const dayStatus = (d) => {
      const dk = dateKey(d);
      if (holidays.has(dk)) return "holiday";
      const classes = attendance[dk];
      if (!classes) return "noclass";
      const vals = Object.values(classes).filter(v => v !== null);
      if (!vals.length) return "unmarked";
      const p = vals.filter(v => v === "present").length;
      const a = vals.filter(v => v === "absent").length;
      if (a === 0) return "present";
      if (p === 0) return "absent";
      return "mixed";
    };

    const dotColor = (st) => ({
      present: green, absent: red, mixed: amber, holiday: sub, noclass: "transparent", unmarked: accent
    }[st] || "transparent");

    const prevMonth = () => setCalMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
    const nextMonth = () => setCalMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });

    const selectedDk = calSelected ? dateKey(calSelected) : null;

    return (
      <div style={s.content}>
        {/* Month nav */}
        <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", color: text, cursor: "pointer", width: 32, height: 32 }}><Icon.ChevronLeft /></button>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{MONTHS[calMonth.m]} {calMonth.y}</div>
          <button onClick={nextMonth} style={{ background: "none", border: "none", color: text, cursor: "pointer", width: 32, height: 32 }}><Icon.ChevronRight /></button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "10px 16px 4px", gap: 2 }}>
          {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: sub, fontWeight: 700 }}>{d}</div>)}
        </div>

        {/* Grid */}
        <div style={s.calGrid}>
          {blanks.map((_, i) => <div key={`b${i}`} />)}
          {days.map(d => {
            const dk = dateKey(d);
            const st = dayStatus(d);
            const isToday = dk === todayKey;
            const isSel = dk === selectedDk;
            return (
              <div key={dk} onClick={() => setCalSelected(isSel ? null : d)}
                style={{ ...s.calDay(isSel ? "selected" : isToday ? "today" : null), padding: "4px 2px 2px" }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? accent : text }}>{d.getDate()}</div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor(st), marginTop: 2 }} />
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ padding: "0 20px 12px", display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[["Present", green], ["Absent", red], ["Mixed", amber], ["Holiday", sub], ["Today", accent]].map(([l, c]) => (
            <div key={l} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
              <span style={{ color: sub }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Day detail sheet */}
        {calSelected && (
          <DayDetail d={calSelected} dk={selectedDk} attendance={attendance} holidays={holidays}
            mark={mark} toggleHoliday={toggleHoliday} s={s} sub={sub} border={border} green={green} red={red} amber={amber} accent={accent} text={text} card={card} card2={card2} dark={dark} />
        )}
      </div>
    );
  };

  // ── Subjects ──
  const SubjectsTab = () => (
    <div style={s.content}>
      <div style={s.section}>
        <div style={s.label}>Subject Analytics</div>
        {SUBJECTS.map(subj => {
          const st = subjectStats(subj.id, attendance, holidays);
          const bunk = safeBunk(subj.id, attendance, holidays, 75);
          const rec = needToAttend(subj.id, attendance, holidays, 80);
          const pc = pctColor(st.pct);
          return (
            <div key={subj.id} style={s.card()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: subj.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: subj.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{subj.name}</div>
                    <div style={{ fontSize: 12, color: sub }}>{st.present}/{st.total} classes</div>
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: pc }}>{st.pct}%</div>
              </div>
              <div style={s.progressBg}><div style={{ ...s.progressFill(st.pct, pc), height: 8 }} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, background: card2, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: sub, fontWeight: 600 }}>CAN BUNK</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: bunk > 0 ? green : red }}>{bunk}</div>
                  <div style={{ fontSize: 10, color: sub }}>classes (stay ≥75%)</div>
                </div>
                <div style={{ flex: 1, background: card2, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: sub, fontWeight: 600 }}>NEED TO ATTEND</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: rec === 0 ? green : amber }}>{rec}</div>
                  <div style={{ fontSize: 10, color: sub }}>classes to reach 80%</div>
                </div>
                <div style={{ flex: 1, background: card2, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: sub, fontWeight: 600 }}>IF NEXT</div>
                  <ForecastCell subjectId={subj.id} attendance={attendance} holidays={holidays} pctColor={pctColor} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Reports ──
  const ReportsTab = () => {
    const [period, setPeriod] = useState("week");
    const overall7 = weeklyData(attendance, holidays);
    return (
      <div style={s.content}>
        <div style={s.section}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["week", "month"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ ...s.pill(period === p ? accent : `${accent}22`, period === p ? "#fff" : accent), fontSize: 12 }}>
                {p === "week" ? "Last 7 Days" : "This Month"}
              </button>
            ))}
          </div>

          <div style={s.card()}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Attendance Trend</div>
            <MiniChart data={overall7} green={green} red={red} border={border} sub={sub} d={d} />
          </div>

          {SUBJECTS.map(subj => {
            const st = subjectStats(subj.id, attendance, holidays);
            const trend = getTrend(subj.id, attendance, holidays);
            return (
              <div key={subj.id} style={s.card({ padding: "12px 16px" })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: subj.color }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{subj.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: sub }}>{st.present}/{st.total}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: pctColor(st.pct) }}>{st.pct}%</span>
                    <span style={{ color: trend >= 0 ? green : red, width: 16, height: 16 }}>
                      {trend >= 0 ? <Icon.TrendUp /> : <Icon.TrendDown />}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <button style={{ ...s.card({ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", cursor: "pointer", border: `1px dashed ${border}` }) }}
            onClick={() => showSnack("📄 CSV exported to Downloads")}>
            <span style={{ width: 20, height: 20, color: accent }}><Icon.Download /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: accent }}>Export CSV / PDF</span>
          </button>
        </div>
      </div>
    );
  };

  // ── Settings ──
  const SettingsTab = () => (
    <div style={s.content}>
      <div style={s.section}>
        <div style={s.label}>Preferences</div>
        <div style={s.card()}>
          {[
            ["Attendance Threshold", "75%", null],
            ["Reminder Before Class", "10 min", null],
            ["Auto-backup", "Google Drive", null],
            ["Week starts on", "Monday", null],
          ].map(([k, v]) => (
            <div key={k} style={{ ...s.subjectRow }}>
              <span style={{ fontSize: 14 }}>{k}</span>
              <span style={{ fontSize: 13, color: accent, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={s.label}>Timetable</div>
        <div style={s.card()}>
          {[1, 2, 3, 4, 5].map(dow => (
            <div key={dow} style={{ ...s.subjectRow, flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: sub, marginBottom: 4 }}>
                {["Mon","Tue","Wed","Thu","Fri"][dow - 1]}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(TIMETABLE[dow] || []).map(({ time, subjectId }) => {
                  const subj = SUBJECTS.find(s => s.id === subjectId);
                  return (
                    <span key={time + subjectId} style={{ background: subj.color + "22", color: subj.color, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>
                      {time} {subj.short}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={s.label}>Manage Holidays</div>
        <div style={s.card()}>
          {["2026-01-26", "2026-05-01", "2026-05-25"].map(dk => (
            <div key={dk} style={s.subjectRow}>
              <span style={{ fontSize: 13 }}>{dk}</span>
              <span style={{ fontSize: 11, color: holidays.has(dk) ? green : sub, fontWeight: 600 }}>
                {holidays.has(dk) ? "Holiday ✓" : "Removed"}
              </span>
            </div>
          ))}
        </div>

        <button onClick={() => showSnack("☁️ Backup complete!")}
          style={{ ...s.pill(accent), width: "100%", padding: "14px", fontSize: 14, borderRadius: 12, marginBottom: 12 }}>
          ☁️ Backup Now
        </button>
      </div>
    </div>
  );

  const TABS = [
    { id: "home", label: "Home", Icon: Icon.Home },
    { id: "calendar", label: "Calendar", Icon: Icon.Calendar },
    { id: "subjects", label: "Subjects", Icon: Icon.BookOpen },
    { id: "reports", label: "Reports", Icon: Icon.BarChart },
    { id: "settings", label: "Settings", Icon: Icon.Settings },
  ];

  return (
    <div style={s.app}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTitle}>done<span style={{ color: accent }}>.</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={s.pctBadge}>{overall.pct}% overall</div>
          <button onClick={() => setDark(!dark)}
            style={{ background: "none", border: "none", color: sub, cursor: "pointer", width: 28, height: 28 }}>
            {dark ? <Icon.Sun /> : <Icon.Moon />}
          </button>
        </div>
      </div>

      {/* Bulk edit banner */}
      {bulkMode && (
        <div style={{ background: accent, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Bulk Edit: {bulkSelected.size} selected</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setBulkMode(false); setBulkSelected(new Set()); }} style={{ ...s.pill("rgba(255,255,255,0.2)", "#fff"), fontSize: 11 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tab content */}
      {tab === "home" && <HomeTab />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "subjects" && <SubjectsTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "settings" && <SettingsTab />}

      {/* Snackbar */}
      {snackbar && (
        <div style={s.snack}>
          <span>{snackbar.msg}</span>
          {snackbar.undoable && lastAction && (
            <button onClick={undo} style={{ background: accent, border: "none", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Undo
            </button>
          )}
        </div>
      )}

      {/* Bottom nav */}
      <nav style={s.nav}>
        {TABS.map(({ id, label, Icon: Ic }) => (
          <button key={id} onClick={() => setTab(id)} style={s.navBtn(tab === id)}>
            <span style={s.navIcon}><Ic /></span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayDetail({ d, dk, attendance, holidays, mark, toggleHoliday, s, sub, border, green, red, amber, accent, text, card, card2, dark }) {
  const dow = d.getDay();
  const classes = TIMETABLE[dow] || [];
  const isHoliday = holidays.has(dk);

  return (
    <div style={{ margin: "0 16px 16px", background: card, border: `1px solid ${border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{d.toDateString()}</div>
          <div style={{ fontSize: 12, color: sub }}>{classes.length} class{classes.length !== 1 ? "es" : ""}</div>
        </div>
        <button onClick={() => toggleHoliday(dk)}
          style={{ background: isHoliday ? `${amber}22` : `${sub}22`, color: isHoliday ? amber : sub, border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {isHoliday ? "🎉 Holiday" : "Mark Holiday"}
        </button>
      </div>
      {isHoliday ? (
        <div style={{ padding: 20, textAlign: "center", color: sub, fontSize: 13 }}>Holiday — excluded from calculations</div>
      ) : classes.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: sub, fontSize: 13 }}>No classes on this day</div>
      ) : (
        classes.map(({ time, subjectId }, i) => {
          const subj = SUBJECTS.find(s => s.id === subjectId);
          const status = attendance[dk]?.[subjectId];
          return (
            <div key={i} style={{ padding: "10px 16px", borderBottom: i < classes.length - 1 ? `1px solid ${border}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: subj.color }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{subj.name}</div>
                  <div style={{ fontSize: 11, color: sub }}>{time}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => mark(dk, subjectId, "present")}
                  style={{ background: status === "present" ? green : `${green}22`, color: status === "present" ? "#fff" : green, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  ✓
                </button>
                <button onClick={() => mark(dk, subjectId, "absent")}
                  style={{ background: status === "absent" ? red : `${red}22`, color: status === "absent" ? "#fff" : red, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  ✗
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ForecastCell({ subjectId, attendance, holidays, pctColor }) {
  const { total, present } = subjectStats(subjectId, attendance, holidays);
  const ifPresent = total + 1 > 0 ? Math.round(((present + 1) / (total + 1)) * 100) : 100;
  const ifAbsent = total + 1 > 0 ? Math.round((present / (total + 1)) * 100) : 100;
  return (
    <div>
      <div style={{ fontSize: 11, color: pctColor(ifPresent) }}>P: {ifPresent}%</div>
      <div style={{ fontSize: 11, color: pctColor(ifAbsent) }}>A: {ifAbsent}%</div>
    </div>
  );
}

function weeklyData(attendance, holidays) {
  const result = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dk = dateKey(d);
    if (holidays.has(dk)) { result.push({ label: DAYS_SHORT[d.getDay()], pct: null }); continue; }
    const classes = attendance[dk];
    if (!classes) { result.push({ label: DAYS_SHORT[d.getDay()], pct: null }); continue; }
    const vals = Object.values(classes).filter(v => v !== null);
    if (!vals.length) { result.push({ label: DAYS_SHORT[d.getDay()], pct: null }); continue; }
    const p = vals.filter(v => v === "present").length;
    result.push({ label: DAYS_SHORT[d.getDay()], pct: Math.round((p / vals.length) * 100) });
  }
  return result;
}

function getTrend(subjectId, attendance, holidays) {
  const today = new Date();
  let recentP = 0, recentT = 0, olderP = 0, olderT = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dk = dateKey(d);
    if (holidays.has(dk)) continue;
    const cls = attendance[dk];
    if (!cls || cls[subjectId] === undefined || cls[subjectId] === null) continue;
    if (i < 7) { recentT++; if (cls[subjectId] === "present") recentP++; }
    else { olderT++; if (cls[subjectId] === "present") olderP++; }
  }
  const r = recentT ? recentP / recentT : 0;
  const o = olderT ? olderP / olderT : 0;
  return r - o;
}

function MiniChart({ data, green, red, border, sub, d }) {
  const valid = data.filter(x => x.pct !== null);
  const max = 100, min = 0, h = 70, w = 280;
  const pts = data.map((x, i) => {
    const xp = (i / (data.length - 1)) * w;
    const yp = x.pct !== null ? h - ((x.pct - min) / (max - min)) * h : null;
    return { x: xp, y: yp, ...x };
  });
  const linePts = pts.filter(p => p.y !== null);
  const pathD = linePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={w} height={h + 24} style={{ display: "block", marginBottom: 0 }}>
        <line x1={0} y1={h * 0.25} x2={w} y2={h * 0.25} stroke={border} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={0} y1={h * 0.5} x2={w} y2={h * 0.5} stroke={border} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={0} y1={h * 0.75} x2={w} y2={h * 0.75} stroke={border} strokeWidth={1} strokeDasharray="3,3" />
        {pathD && <path d={pathD} fill="none" stroke={green} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {linePts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={p.pct >= 75 ? green : red} />
        ))}
        {data.map((x, i) => (
          <text key={i} x={(i / (data.length - 1)) * w} y={h + 18} textAnchor="middle" fill={sub} fontSize={10}>{x.label}</text>
        ))}
      </svg>
    </div>
  );
}

function WeeklySummary({ attendance, holidays, d, s, sub, border, card, green }) {
  const today = new Date();
  let wp = 0, wt = 0;
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    const dk = dateKey(day);
    if (holidays.has(dk)) continue;
    const classes = attendance[dk];
    if (!classes) continue;
    Object.values(classes).forEach(v => {
      if (v === "present") { wp++; wt++; }
      else if (v === "absent") wt++;
    });
  }
  const pct = wt ? Math.round((wp / wt) * 100) : 0;

  return (
    <div style={{ ...s.card({ display: "flex", gap: 12, alignItems: "center" }) }}>
      <span style={{ fontSize: 24 }}>📊</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Weekly Summary</div>
        <div style={{ fontSize: 12, color: sub }}>This week: {wp}/{wt} present ({pct}%)</div>
      </div>
      <div style={{ marginLeft: "auto", fontSize: 22, fontWeight: 900, color: green }}>{pct}%</div>
    </div>
  );
}
