import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── STORAGE KEY (never change this or data appears lost) ───
const SK = "habitflow-data-v1";

// ─── THEME ───
const DARK = {
  bg:          "#0a0a12",
  surface:     "#0f0f1a",
  card:        "#13131f",
  cardHover:   "#17172a",
  elevated:    "#1c1c2e",
  border:      "#252538",
  borderLight: "#2e2e48",
  text:        "#eeeef5",
  textSub:     "#9898b8",
  textMuted:   "#4a4a6a",
  purple:      "#8b5cf6",
  purpleLight: "#a78bfa",
  purpleDim:   "#8b5cf615",
  purpleGlow:  "0 0 20px #8b5cf630",
  todayBg:     "#8b5cf610",
  todayBorder: "#8b5cf6",
  green:       "#34d399",
  yellow:      "#fbbf24",
  red:         "#f87171",
  header:      "rgba(10,10,18,0.94)",
};

const LIGHT = {
  bg:          "#f4f3ff",
  surface:     "#ede9ff",
  card:        "#ffffff",
  cardHover:   "#f9f7ff",
  elevated:    "#f0eeff",
  border:      "#d8d0f5",
  borderLight: "#c4b8f0",
  text:        "#1a1a2e",
  textSub:     "#5c5a80",
  textMuted:   "#9896b8",
  purple:      "#7c3aed",
  purpleLight: "#8b5cf6",
  purpleDim:   "#7c3aed12",
  purpleGlow:  "0 0 20px #7c3aed28",
  todayBg:     "#7c3aed0e",
  todayBorder: "#7c3aed",
  green:       "#059669",
  yellow:      "#d97706",
  red:         "#dc2626",
  header:      "rgba(244,243,255,0.95)",
};

// ─── CONSTANTS ───
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WSHORT = ["S","M","T","W","T","F","S"];

const HABIT_ICONS = [
  "🔥","💧","🏃","📚","🧘","💪","🥗","😴","✍️","🎯",
  "🎨","🎵","🌿","💊","🧹","💰","🤝","🧠","☀️","🌙",
  "🏋️","🚴","🍎","🥤","📷","🛁","🐾","💭","⚡","🎯"
];

const COLORS = [
  "#8b5cf6","#06b6d4","#f59e0b","#ec4899","#10b981",
  "#3b82f6","#ef4444","#84cc16","#f97316","#a855f7",
  "#14b8a6","#e879f9"
];

const QUOTES = [
  "Small disciplines repeated with consistency lead to great achievements.",
  "We are what we repeatedly do. Excellence is not an act, but a habit.",
  "Motivation gets you started. Habit keeps you going.",
  "The secret of getting ahead is getting started.",
  "Every action is a vote for the person you want to become.",
  "You don't rise to the level of your goals, you fall to the level of your systems.",
  "Success is the sum of small efforts repeated day in and day out.",
];

// ─── STORAGE HELPERS ───
async function storageLoad() {
  try {
    const result = await window.storage.get(SK);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      return parsed;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function storageSave(data) {
  try {
    await window.storage.set(SK, JSON.stringify(data));
  } catch (err) {
    // silent
  }
}

// ─── DATE UTILS ───
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function dateKey(y, m, d) {
  return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}
function getToday() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}

// ─── STREAK CALC ───
function calcStreak(hid, logs) {
  let count = 0;
  const t = new Date();
  for (let i = 0; i < 366; i++) {
    const k = dateKey(t.getFullYear(), t.getMonth(), t.getDate());
    if (logs[k] && logs[k][hid]) {
      count++;
      t.setDate(t.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}
function calcLongest(hid, logs) {
  const keys = Object.keys(logs).filter(function(k) { return logs[k] && logs[k][hid]; }).sort();
  let max = 0, cur = 0, prevDate = null;
  for (let i = 0; i < keys.length; i++) {
    const d = new Date(keys[i]);
    if (prevDate && (d - prevDate) / 86400000 === 1) {
      cur++;
    } else {
      cur = 1;
    }
    if (cur > max) max = cur;
    prevDate = d;
  }
  return max;
}
function calcTotal(hid, logs) {
  let count = 0;
  const vals = Object.values(logs);
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] && vals[i][hid]) count++;
  }
  return count;
}

// ══════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════
export default function App() {
  const TODAY = useMemo(function() { return getToday(); }, []);

  // ── state ──
  const [loaded, setLoaded]   = useState(false);
  const [view,   setView]     = useState("tracker");
  const [cY,     setCY]       = useState(TODAY.y);
  const [cM,     setCM]       = useState(TODAY.m);
  const [habits, setHabits]   = useState([]);
  const [logs,   setLogs]     = useState({});
  const [notes,  setNotes]    = useState({});
  const [theme,  setTheme]    = useState("dark");
  const T = theme === "dark" ? DARK : LIGHT;

  const [modal,     setModal]     = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState({ name: "", icon: "🔥", color: COLORS[0], goal: 5 });
  const [noteDay,   setNoteDay]   = useState(null);
  const [noteText,  setNoteText]  = useState("");
  const [toast,     setToast]     = useState(null);
  const [analOpen,  setAnalOpen]  = useState(null);
  const [quote]     = useState(function() { return QUOTES[Math.floor(Math.random() * QUOTES.length)]; });

  const saveTimerRef  = useRef(null);
  const toastTimerRef = useRef(null);

  // ── LOAD from storage (runs once on mount) ──
  useEffect(function() {
    storageLoad().then(function(data) {
      if (data) {
        if (Array.isArray(data.habits)) setHabits(data.habits);
        if (data.logs && typeof data.logs === "object") setLogs(data.logs);
        if (data.notes && typeof data.notes === "object") setNotes(data.notes);
        if (data.theme === "light" || data.theme === "dark") setTheme(data.theme);
      }
      setLoaded(true);
    });
  }, []);

  // ── SAVE to storage (debounced, only after initial load) ──
  useEffect(function() {
    if (!loaded) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(function() {
      storageSave({ habits: habits, logs: logs, notes: notes, theme: theme });
    }, 800);
    return function() { clearTimeout(saveTimerRef.current); };
  }, [habits, logs, notes, theme, loaded]);

  // ── TOAST helper ──
  const showToast = useCallback(function(msg, type) {
    clearTimeout(toastTimerRef.current);
    setToast({ msg: msg, type: type || "ok" });
    toastTimerRef.current = setTimeout(function() { setToast(null); }, 2200);
  }, []);

  // ── TOGGLE LOG ──
  const toggleLog = useCallback(function(hid, day) {
    const k = dateKey(cY, cM, day);
    setLogs(function(prev) {
      const dayObj = Object.assign({}, prev[k] || {});
      if (dayObj[hid]) {
        delete dayObj[hid];
      } else {
        dayObj[hid] = true;
      }
      const next = Object.assign({}, prev);
      if (Object.keys(dayObj).length > 0) {
        next[k] = dayObj;
      } else {
        delete next[k];
      }
      return next;
    });
  }, [cY, cM]);

  // ── HABIT CRUD ──
  function openAddHabit() {
    setForm({ name: "", icon: "🔥", color: COLORS[0], goal: 5 });
    setEditingId(null);
    setModal("habit");
  }
  function openEditHabit(h) {
    setForm({ name: h.name, icon: h.icon, color: h.color, goal: h.goal });
    setEditingId(h.id);
    setModal("habit");
  }
  function saveHabit() {
    if (!form.name.trim()) return;
    if (editingId) {
      setHabits(function(prev) {
        return prev.map(function(h) {
          return h.id === editingId ? Object.assign({}, h, form) : h;
        });
      });
      showToast("Habit updated");
    } else {
      const newHabit = Object.assign({}, form, {
        id: "h" + Date.now(),
        createdAt: dateKey(TODAY.y, TODAY.m, TODAY.d)
      });
      setHabits(function(prev) { return prev.concat([newHabit]); });
      showToast("Habit added!");
    }
    setModal(null);
  }
  function deleteHabit(id) {
    setHabits(function(prev) { return prev.filter(function(h) { return h.id !== id; }); });
    showToast("Removed");
  }

  // ── NOTES ──
  function openNote(day) {
    const k = dateKey(cY, cM, day);
    setNoteDay({ day: day, key: k });
    setNoteText(notes[k] || "");
    setModal("note");
  }
  function saveNote() {
    if (!noteDay) return;
    setNotes(function(prev) {
      const next = Object.assign({}, prev);
      if (noteText.trim()) {
        next[noteDay.key] = noteText;
      } else {
        delete next[noteDay.key];
      }
      return next;
    });
    setModal(null);
    showToast("Note saved");
  }

  // ── MONTH NAV ──
  function prevMonth() {
    if (cM === 0) { setCM(11); setCY(function(y) { return y - 1; }); }
    else setCM(function(m) { return m - 1; });
  }
  function nextMonth() {
    if (cM === 11) { setCM(0); setCY(function(y) { return y + 1; }); }
    else setCM(function(m) { return m + 1; });
  }

  // ── COMPUTED ──
  const D = daysInMonth(cY, cM);
  const isCurrentMonth = cY === TODAY.y && cM === TODAY.m;

  const stats = useMemo(function() {
    return habits.map(function(h) {
      let done = 0;
      for (let d = 1; d <= D; d++) {
        const k = dateKey(cY, cM, d);
        if (logs[k] && logs[k][h.id]) done++;
      }
      return Object.assign({}, h, {
        done:    done,
        pct:     Math.round(done / D * 100),
        streak:  calcStreak(h.id, logs),
        longest: calcLongest(h.id, logs),
        total:   calcTotal(h.id, logs),
      });
    });
  }, [habits, logs, cY, cM, D]);

  const totalDone     = useMemo(function() { return stats.reduce(function(a, s) { return a + s.done; }, 0); }, [stats]);
  const totalPossible = habits.length * D;
  const overallPct    = totalPossible ? Math.round(totalDone / totalPossible * 100) : 0;
  const bestStreakStat = useMemo(function() { return stats.slice().sort(function(a, b) { return b.streak - a.streak; })[0]; }, [stats]);

  // ── LOADING SCREEN ──
  if (!loaded) {
    return (
      <div style={{ background: DARK.bg, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "'Playfair Display', Georgia, serif" }}>
        <div style={{ fontSize: 28, color: DARK.purpleLight, fontWeight: 700 }}>HabitFlow</div>
        <div style={{ width: 32, height: 32, border: "3px solid " + DARK.border, borderTopColor: DARK.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif", transition: "background 0.3s, color 0.3s" }}>
      <InlineStyles T={T} />

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.type === "ok" ? "linear-gradient(135deg," + T.purple + "," + T.purpleLight + ")" : T.elevated,
          color: toast.type === "ok" ? "#fff" : T.textSub,
          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          animation: "slideInRight 0.25s ease", border: "1px solid " + T.border
        }}>
          {toast.msg}
        </div>
      )}

      {/* NAV BAR */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: T.header,
        borderBottom: "1px solid " + T.border,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)"
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg," + T.purple + "," + T.purpleLight + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 700, color: T.purpleLight, letterSpacing: "-0.3px" }}>HabitFlow</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["tracker","📅"],["analytics","📊"],["settings","⚙️"]].map(function(item) {
              const v = item[0], icon = item[1];
              const active = view === v;
              return (
                <button key={v} onClick={function() { setView(v); }} style={{
                  padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                  background: active ? T.purple : "transparent",
                  color: active ? "#fff" : T.textSub,
                  transition: "all 0.18s"
                }}>
                  {icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 14px 80px" }}>

        {view === "tracker"   && <TrackerView   T={T} cY={cY} cM={cM} D={D} TODAY={TODAY} isCurrentMonth={isCurrentMonth} habits={habits} logs={logs} notes={notes} stats={stats} overallPct={overallPct} totalDone={totalDone} totalPossible={totalPossible} bestStreakStat={bestStreakStat} quote={quote} prevMonth={prevMonth} nextMonth={nextMonth} toggleLog={toggleLog} openAddHabit={openAddHabit} openEditHabit={openEditHabit} deleteHabit={deleteHabit} openNote={openNote} />}
        {view === "analytics" && <AnalyticsView T={T} habits={habits} logs={logs} stats={stats} cY={cY} cM={cM} D={D} TODAY={TODAY} overallPct={overallPct} totalDone={totalDone} totalPossible={totalPossible} analOpen={analOpen} setAnalOpen={setAnalOpen} />}
        {view === "settings"  && <SettingsView  T={T} theme={theme} setTheme={setTheme} habits={habits} logs={logs} notes={notes} setHabits={setHabits} setLogs={setLogs} setNotes={setNotes} showToast={showToast} />}

      </div>

      {/* MODALS */}
      {modal === "habit" && (
        <ModalOverlay T={T} onClose={function() { setModal(null); }}>
          <HabitForm T={T} form={form} setForm={setForm} isEdit={!!editingId} onSave={saveHabit} onClose={function() { setModal(null); }} />
        </ModalOverlay>
      )}
      {modal === "note" && noteDay && (
        <ModalOverlay T={T} onClose={function() { setModal(null); }}>
          <NoteForm T={T} day={noteDay.day} month={cM} year={cY} text={noteText} setText={setNoteText} onSave={saveNote} onClose={function() { setModal(null); }} />
        </ModalOverlay>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  TRACKER VIEW
// ══════════════════════════════════════════════
function TrackerView(props) {
  var T = props.T, cY = props.cY, cM = props.cM, D = props.D, TODAY = props.TODAY;
  var isCurrentMonth = props.isCurrentMonth, habits = props.habits, logs = props.logs;
  var notes = props.notes, stats = props.stats, overallPct = props.overallPct;
  var totalDone = props.totalDone, totalPossible = props.totalPossible;
  var bestStreakStat = props.bestStreakStat, quote = props.quote;
  var prevMonth = props.prevMonth, nextMonth = props.nextMonth;
  var toggleLog = props.toggleLog, openAddHabit = props.openAddHabit;
  var openEditHabit = props.openEditHabit, deleteHabit = props.deleteHabit, openNote = props.openNote;

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <button onClick={prevMonth} style={{ background: T.elevated, border: "1px solid " + T.border, color: T.textSub, width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1, letterSpacing: "-0.5px" }}>{MONTHS[cM]}</div>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>{cY} &middot; {D} days</div>
        </div>
        <button onClick={nextMonth} style={{ background: T.elevated, border: "1px solid " + T.border, color: T.textSub, width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>›</button>
      </div>

      {/* Quote */}
      <div style={{ textAlign: "center", padding: "12px 8px 16px", fontSize: 12, color: T.textMuted, fontStyle: "italic", lineHeight: 1.5 }}>
        "{quote}"
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Overall",      value: overallPct + "%",                        sub: totalDone + "/" + totalPossible, accent: true },
          { label: "Habits",       value: String(habits.length),                   sub: "tracked" },
          { label: "Best streak",  value: bestStreakStat ? bestStreakStat.streak + "d" : "—", sub: bestStreakStat ? bestStreakStat.name : "none", accent: true },
        ].map(function(card) {
          return (
            <div key={card.label} style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: card.accent ? T.purpleLight : T.text, lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>{card.label}</div>
              <div style={{ fontSize: 10, color: T.textSub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "11px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 5, background: T.elevated, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg," + T.purple + "," + T.purpleLight + ")", width: overallPct + "%", transition: "width 0.7s ease", boxShadow: T.purpleGlow }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.purpleLight, minWidth: 32, textAlign: "right" }}>{overallPct}%</span>
        </div>
      )}

      {habits.length === 0 ? (
        <div style={{ background: T.card, border: "1px dashed " + T.border, borderRadius: 16, padding: "44px 20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Start Your Journey</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 22 }}>Add your first habit and begin building streaks that transform your life.</div>
          <button onClick={openAddHabit} style={{ background: "linear-gradient(135deg," + T.purple + "," + T.purpleLight + ")", color: "#fff", border: "none", padding: "12px 26px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: T.purpleGlow }}>+ Add First Habit</button>
        </div>
      ) : (
        <div>
          {/* Habit grid */}
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ minWidth: Math.max(480, 162 + D * 32 + 64) }}>

                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", background: T.surface, borderBottom: "1px solid " + T.border, padding: "8px 0" }}>
                  <div style={{ width: 162, minWidth: 162, padding: "0 14px", fontSize: 9, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>Habit</div>
                  {Array.from({ length: D }, function(_, i) { return i + 1; }).map(function(d) {
                    const dow = new Date(cY, cM, d).getDay();
                    const isToday = isCurrentMonth && d === TODAY.d;
                    return (
                      <div key={d} style={{ width: 32, minWidth: 32, textAlign: "center", position: "relative" }}>
                        {isToday && (
                          <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", width: 26, bottom: -1, background: T.todayBg, borderRadius: "4px 4px 0 0", border: "1px solid " + T.todayBorder + "44", borderBottom: "none", pointerEvents: "none" }} />
                        )}
                        <div style={{ position: "relative", zIndex: 1 }}>
                          <div style={{ fontSize: 8, color: isToday ? T.purpleLight : T.textMuted, fontWeight: isToday ? "700" : "400", letterSpacing: "0.04em" }}>{WSHORT[dow]}</div>
                          <div style={{ fontSize: 11, fontWeight: isToday ? "700" : "400", color: isToday ? T.purpleLight : T.textSub, marginTop: 1, lineHeight: 1 }}>{d}</div>
                          {isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.purple, margin: "2px auto 0", boxShadow: "0 0 6px " + T.purple }} />}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ width: 64, minWidth: 64, textAlign: "center", fontSize: 9, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Done</div>
                </div>

                {/* Habit rows */}
                {habits.map(function(h, hi) {
                  const st = stats.find(function(s) { return s.id === h.id; }) || { done: 0, pct: 0, streak: 0 };
                  return (
                    <div key={h.id} className="hrow" style={{ display: "flex", alignItems: "center", borderBottom: "1px solid " + T.border + "80", animationDelay: (hi * 0.04) + "s" }}>

                      {/* Habit name cell */}
                      <div onClick={function() { openEditHabit(h); }} style={{ width: 162, minWidth: 162, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: h.color + "20", border: "1px solid " + h.color + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{h.icon}</div>
                        <div style={{ overflow: "hidden", flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                            <span style={{ color: T.purpleLight }}>🔥</span> {st.streak}d
                          </div>
                        </div>
                      </div>

                      {/* Day check cells */}
                      {Array.from({ length: D }, function(_, i) { return i + 1; }).map(function(d) {
                        const k = dateKey(cY, cM, d);
                        const checked = !!(logs[k] && logs[k][h.id]);
                        const isFuture = isCurrentMonth && d > TODAY.d;
                        const isToday  = isCurrentMonth && d === TODAY.d;
                        const hasNote  = !!(notes[k]);
                        return (
                          <div key={d} style={{ width: 32, minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: isToday ? T.todayBg : "transparent" }}>
                            {hasNote && !checked && (
                              <div style={{ position: "absolute", top: 5, right: 5, width: 4, height: 4, borderRadius: "50%", background: T.purpleLight, opacity: 0.8 }} />
                            )}
                            <button
                              onClick={function() { if (!isFuture) toggleLog(h.id, d); }}
                              style={{
                                width: 21, height: 21, borderRadius: 6, flexShrink: 0,
                                border: "1.5px solid " + (checked ? h.color : isToday ? T.purple + "66" : T.border),
                                background: checked ? h.color : isToday ? T.purple + "14" : "transparent",
                                cursor: isFuture ? "default" : "pointer",
                                opacity: isFuture ? 0.22 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.12s",
                                boxShadow: checked ? "0 0 8px " + h.color + "50" : "none",
                              }}
                            >
                              {checked && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </button>
                          </div>
                        );
                      })}

                      {/* % cell */}
                      <div style={{ width: 64, minWidth: 64, padding: "0 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: st.pct >= 80 ? T.green : st.pct >= 50 ? T.yellow : T.red }}>{st.pct}%</div>
                        <div style={{ height: 3, background: T.elevated, borderRadius: 2, marginTop: 3 }}>
                          <div style={{ height: "100%", borderRadius: 2, background: st.pct >= 80 ? T.green : st.pct >= 50 ? T.yellow : T.red, width: st.pct + "%", transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Daily journal strip */}
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 14, padding: "13px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Daily Journal</div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ display: "flex", gap: 4, minWidth: D * 30 }}>
                {Array.from({ length: D }, function(_, i) { return i + 1; }).map(function(d) {
                  const k = dateKey(cY, cM, d);
                  const hasNote = !!(notes[k]);
                  const isToday = isCurrentMonth && d === TODAY.d;
                  const isFuture = isCurrentMonth && d > TODAY.d;
                  return (
                    <button key={d} onClick={function() { if (!isFuture) openNote(d); }} style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      border: "1px solid " + (hasNote ? T.purpleLight : isToday ? T.purple + "55" : T.border),
                      background: isToday ? T.todayBg : hasNote ? T.purpleDim : "transparent",
                      cursor: isFuture ? "default" : "pointer",
                      fontSize: hasNote ? 12 : 10,
                      color: hasNote ? T.purpleLight : isToday ? T.purpleLight : T.textMuted,
                      opacity: isFuture ? 0.25 : 1,
                      transition: "all 0.13s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {hasNote ? "✦" : d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Manage habits */}
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 14, padding: "14px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Manage Habits</div>
            {habits.map(function(h) {
              const st = stats.find(function(s) { return s.id === h.id; }) || { pct: 0, streak: 0, total: 0 };
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid " + T.border + "60" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: h.color + "20", border: "1px solid " + h.color + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{h.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{h.name}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>Goal: {h.goal}/wk · {st.total} total · {st.streak}d streak</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
                  <button onClick={function() { openEditHabit(h); }} style={{ background: T.elevated, border: "1px solid " + T.border, color: T.textSub, padding: "5px 11px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>Edit</button>
                  <button onClick={function() { deleteHabit(h.id); }} style={{ background: "transparent", border: "1px solid " + T.red + "44", color: T.red, padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add habit button */}
      <button onClick={openAddHabit} style={{ background: "linear-gradient(135deg," + T.purple + "," + T.purpleLight + ")", color: "#fff", border: "none", padding: "13px 24px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", boxShadow: T.purpleGlow, transition: "all 0.2s", display: "block" }}>
        + Add New Habit
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ANALYTICS VIEW
// ══════════════════════════════════════════════
function AnalyticsView(props) {
  var T = props.T, habits = props.habits, logs = props.logs, stats = props.stats;
  var cY = props.cY, cM = props.cM, D = props.D, TODAY = props.TODAY;
  var overallPct = props.overallPct, totalDone = props.totalDone, totalPossible = props.totalPossible;
  var analOpen = props.analOpen, setAnalOpen = props.setAnalOpen;

  var trend = useMemo(function() {
    var arr = [];
    for (var i = 5; i >= 0; i--) {
      var m = TODAY.m - i;
      var y = TODAY.y;
      if (m < 0) { m += 12; y--; }
      var days = daysInMonth(y, m);
      var done = 0;
      habits.forEach(function(h) {
        for (var dd = 1; dd <= days; dd++) {
          var k = dateKey(y, m, dd);
          if (logs[k] && logs[k][h.id]) done++;
        }
      });
      var pct = habits.length ? Math.round(done / (habits.length * days) * 100) : 0;
      arr.push({ label: MONTHS[m].slice(0, 3), pct: pct, isCurrent: m === TODAY.m && y === TODAY.y });
    }
    return arr;
  }, [habits, logs, TODAY]);

  var heatmap = useMemo(function() {
    return Array.from({ length: D }, function(_, i) { return i + 1; }).map(function(d) {
      var k = dateKey(cY, cM, d);
      var done = habits.filter(function(h) { return logs[k] && logs[k][h.id]; }).length;
      return { d: d, pct: habits.length ? done / habits.length : 0 };
    });
  }, [D, cY, cM, habits, logs]);

  var dowStats = useMemo(function() {
    var cnt = [0,0,0,0,0,0,0], tot = [0,0,0,0,0,0,0];
    Object.keys(logs).forEach(function(k) {
      var dow = new Date(k).getDay();
      habits.forEach(function(h) { tot[dow]++; if (logs[k][h.id]) cnt[dow]++; });
    });
    return ["Su","Mo","Tu","We","Th","Fr","Sa"].map(function(l, i) {
      return { label: l, pct: tot[i] ? Math.round(cnt[i] / tot[i] * 100) : 0 };
    });
  }, [logs, habits]);

  var maxTrend = Math.max.apply(null, trend.map(function(t) { return t.pct; }).concat([1]));
  var maxDow   = Math.max.apply(null, dowStats.map(function(d) { return d.pct; }).concat([1]));

  var insights = useMemo(function() {
    var ins = [];
    var sorted = stats.slice().sort(function(a, b) { return b.pct - a.pct; });
    var best = sorted[0], worst = sorted[sorted.length - 1];
    var topStr = stats.slice().sort(function(a, b) { return b.streak - a.streak; })[0];
    if (best && best.pct >= 80) ins.push({ icon: "🏆", title: best.name + " is crushing it", body: best.pct + "% completion this month. You're turning this into an identity." });
    if (worst && worst.pct < 40 && habits.length > 1) ins.push({ icon: "💡", title: worst.name + " needs attention", body: "Only " + worst.pct + "%. Reduce friction — link it to a habit you already do." });
    if (topStr && topStr.streak >= 5) ins.push({ icon: "🔥", title: topStr.streak + "-day streak: " + topStr.name, body: "Don't break the chain. Each day you show up, it becomes harder to quit." });
    if (!ins.length) ins.push({ icon: "✦", title: "Keep tracking consistently", body: "Your insights will grow richer as you build more data. Stay the course." });
    return ins.slice(0, 3);
  }, [stats, habits]);

  if (!habits.length) {
    return (
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 44, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 8 }}>No data yet</div>
        <div style={{ fontSize: 13, color: T.textMuted }}>Add habits and start tracking to see analytics</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, marginBottom: 18, letterSpacing: "-0.5px" }}>Analytics</div>

      {/* Overview */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>Month Overview — {MONTHS[cM]} {cY}</Label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 12 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 48, fontWeight: 700, lineHeight: 1, color: overallPct >= 80 ? T.green : overallPct >= 50 ? T.yellow : T.red }}>
            {overallPct}<span style={{ fontSize: 20 }}>%</span>
          </div>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Completion Rate</div>
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>{totalDone} of {totalPossible} check-ins</div>
          </div>
        </div>
        <div style={{ height: 5, background: T.elevated, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg," + T.purple + "," + T.purpleLight + ")", width: overallPct + "%", transition: "width 0.8s ease", boxShadow: T.purpleGlow }} />
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>Daily Heatmap — {MONTHS[cM]}</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {heatmap.map(function(item) {
            var isToday = cY === TODAY.y && cM === TODAY.m && item.d === TODAY.d;
            var alpha = item.pct === 0 ? 0 : 0.15 + item.pct * 0.85;
            return (
              <div key={item.d} title={"Day " + item.d + ": " + Math.round(item.pct * 100) + "%"} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(139,92,246," + alpha + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: item.pct > 0.5 ? "#fff" : T.textMuted, border: isToday ? "1.5px solid " + T.purple : "1px solid " + T.border, boxShadow: isToday ? "0 0 6px " + T.purple + "80" : "none", fontWeight: isToday ? "700" : "400", cursor: "default" }}>
                {item.d}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
          <span style={{ fontSize: 9, color: T.textMuted }}>None</span>
          {[0.15, 0.35, 0.55, 0.75, 1].map(function(a) {
            return <div key={a} style={{ width: 11, height: 11, borderRadius: 3, background: "rgba(139,92,246," + a + ")" }} />;
          })}
          <span style={{ fontSize: 9, color: T.textMuted }}>All</span>
        </div>
      </div>

      {/* 6-month trend */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>6-Month Trend</Label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {trend.map(function(item, i) {
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: item.isCurrent ? T.purpleLight : T.textMuted, fontWeight: item.isCurrent ? "700" : "400" }}>{item.pct}%</div>
                <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: item.isCurrent ? "linear-gradient(180deg," + T.purpleLight + "," + T.purple + ")" : T.elevated, height: Math.max(item.pct / maxTrend * 70, 3) + "px", border: "1px solid " + (item.isCurrent ? T.purple : T.border), boxShadow: item.isCurrent ? T.purpleGlow : "none", transition: "height 0.7s ease" }} />
                <div style={{ fontSize: 10, color: item.isCurrent ? T.purpleLight : T.textSub, fontWeight: item.isCurrent ? "700" : "400" }}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Best day of week */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>Best Days of Week</Label>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 72 }}>
          {dowStats.map(function(item, i) {
            var isBest = item.pct === Math.max.apply(null, dowStats.map(function(x) { return x.pct; }));
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ fontSize: 9, color: isBest ? T.purpleLight : T.textMuted }}>{item.pct}%</div>
                <div style={{ width: "100%", borderRadius: "3px 3px 0 0", background: isBest ? "linear-gradient(180deg," + T.purpleLight + "," + T.purple + ")" : T.elevated, height: Math.max(item.pct / maxDow * 48, 2) + "px", border: "1px solid " + (isBest ? T.purple : T.border), transition: "height 0.6s ease" }} />
                <div style={{ fontSize: 9, color: isBest ? T.purpleLight : T.textSub, fontWeight: isBest ? "700" : "400" }}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per habit */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>Per Habit</Label>
        {stats.slice().sort(function(a, b) { return b.pct - a.pct; }).map(function(s) {
          return (
            <div key={s.id} style={{ marginBottom: 14, cursor: "pointer" }} onClick={function() { setAnalOpen(analOpen === s.id ? null : s.id); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: s.color + "20", border: "1px solid " + s.color + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>🔥 {s.streak}d · best {s.longest}d · {s.total} total</div>
                  </div>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: s.pct >= 80 ? T.green : s.pct >= 50 ? T.yellow : T.red }}>{s.pct}%</div>
              </div>
              <div style={{ height: 3, background: T.elevated, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: s.pct >= 80 ? T.green : s.pct >= 50 ? T.yellow : T.red, width: s.pct + "%", transition: "width 0.6s ease" }} />
              </div>
              {analOpen === s.id && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginTop: 10 }}>
                  {[["Done", String(s.done)], ["Missed", String(D - s.done)], ["Streak", s.streak + "d"], ["Best", s.longest + "d"]].map(function(cell) {
                    return (
                      <div key={cell[0]} style={{ background: T.elevated, borderRadius: 8, padding: "9px 6px", textAlign: "center", border: "1px solid " + T.border }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: s.color }}>{cell[1]}</div>
                        <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{cell[0]}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Insights */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20 }}>
        <Label T={T}>Smart Insights</Label>
        {insights.map(function(ins, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: i < insights.length - 1 ? "1px solid " + T.border + "60" : "none" }}>
              <div style={{ fontSize: 20, flexShrink: 0 }}>{ins.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 3 }}>{ins.title}</div>
                <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>{ins.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  SETTINGS VIEW
// ══════════════════════════════════════════════
function SettingsView(props) {
  var T = props.T, theme = props.theme, setTheme = props.setTheme;
  var habits = props.habits, logs = props.logs, notes = props.notes;
  var setHabits = props.setHabits, setLogs = props.setLogs, setNotes = props.setNotes, showToast = props.showToast;
  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, marginBottom: 18, letterSpacing: "-0.5px" }}>Settings</div>

      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>Appearance</Label>
        <div style={{ display: "flex", gap: 10 }}>
          {[["dark","🌙 Dark"],["light","☀️ Light"]].map(function(item) {
            var t = item[0], l = item[1];
            var active = theme === t;
            return (
              <button key={t} onClick={function() { setTheme(t); showToast("Theme applied"); }} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "2px solid " + (active ? T.purple : T.border), background: active ? T.purpleDim : "transparent", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: active ? T.purpleLight : T.textSub, transition: "all 0.2s" }}>
                {l}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <Label T={T}>Data Summary</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
          {[[habits.length, "Habits"], [Object.keys(logs).length, "Days"], [Object.keys(notes).length, "Notes"]].map(function(item) {
            return (
              <div key={item[1]} style={{ background: T.elevated, borderRadius: 10, padding: "12px 8px", textAlign: "center", border: "1px solid " + T.border }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: T.purpleLight }}>{item[0]}</div>
                <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>{item[1]}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.7, marginBottom: 14 }}>
          Your data is saved automatically using Claude's persistent storage. It will be here every time you open this artifact, even after closing the app.
        </div>
        <button
          onClick={function() {
            if (window.confirm("Delete all data? This cannot be undone.")) {
              setHabits([]); setLogs({}); setNotes({});
              storageSave({ habits: [], logs: {}, notes: {}, theme: theme });
              showToast("All data cleared");
            }
          }}
          style={{ background: "transparent", border: "1px solid " + T.red + "55", color: T.red, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}
        >
          Clear All Data
        </button>
      </div>

      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20 }}>
        <Label T={T}>About</Label>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, fontWeight: 700, color: T.purpleLight, marginBottom: 8 }}>HabitFlow Premium</div>
        <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.75, marginBottom: 14 }}>
          Your personal habit tracking companion, built to live inside Claude.ai. Track every day, review your analytics, and build the streaks that define who you're becoming.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {["✦ Persistent Storage","✦ Streak Tracking","✦ Analytics","✦ Daily Journal","✦ Smart Insights","✦ 2 Themes"].map(function(f) {
            return <span key={f} style={{ background: T.purpleDim, color: T.purpleLight, padding: "4px 10px", borderRadius: 20, fontSize: 11, border: "1px solid " + T.purple + "33" }}>{f}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  FORMS + MODAL
// ══════════════════════════════════════════════
function HabitForm(props) {
  var T = props.T, form = props.form, setForm = props.setForm, isEdit = props.isEdit, onSave = props.onSave, onClose = props.onClose;
  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 18, color: T.text }}>{isEdit ? "Edit Habit" : "New Habit"}</div>

      <Label T={T}>Name</Label>
      <input
        value={form.name}
        onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { name: e.target.value }); }); }}
        onKeyDown={function(e) { if (e.key === "Enter") onSave(); }}
        placeholder="e.g. Morning Run"
        style={{ width: "100%", background: T.elevated, border: "1px solid " + T.border, color: T.text, borderRadius: 9, padding: "10px 13px", fontSize: 13, marginBottom: 16, outline: "none", fontFamily: "'DM Sans',sans-serif", transition: "border 0.2s" }}
      />

      <Label T={T}>Icon</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {HABIT_ICONS.map(function(ic) {
          return (
            <button key={ic} onClick={function() { setForm(function(p) { return Object.assign({}, p, { icon: ic }); }); }} style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid " + (form.icon === ic ? T.purple : T.border), background: form.icon === ic ? T.purpleDim : "transparent", cursor: "pointer", fontSize: 17, transition: "all 0.13s" }}>{ic}</button>
          );
        })}
      </div>

      <Label T={T}>Color</Label>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
        {COLORS.map(function(c) {
          return (
            <button key={c} onClick={function() { setForm(function(p) { return Object.assign({}, p, { color: c }); }); }} style={{ width: 26, height: 26, borderRadius: 7, background: c, border: "2.5px solid " + (form.color === c ? "#fff" : "transparent"), cursor: "pointer", transform: form.color === c ? "scale(1.2)" : "scale(1)", transition: "all 0.13s", boxShadow: form.color === c ? "0 0 8px " + c + "80" : "none" }} />
          );
        })}
      </div>

      <Label T={T}>Weekly Goal — <span style={{ color: T.purpleLight, fontWeight: 600 }}>{form.goal} day{form.goal !== 1 ? "s" : ""}/week</span></Label>
      <input type="range" min={1} max={7} value={form.goal} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { goal: parseInt(e.target.value, 10) }); }); }} style={{ width: "100%", marginBottom: 20, accentColor: T.purple, cursor: "pointer" }} />

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid " + T.border, color: T.textSub, padding: "11px", borderRadius: 10, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Cancel</button>
        <button onClick={onSave} disabled={!form.name.trim()} style={{ flex: 2, background: "linear-gradient(135deg," + T.purple + "," + T.purpleLight + ")", border: "none", color: "#fff", padding: "11px", borderRadius: 10, cursor: form.name.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, opacity: form.name.trim() ? 1 : 0.45 }}>
          {isEdit ? "Save Changes" : "Create Habit"}
        </button>
      </div>
    </div>
  );
}

function NoteForm(props) {
  var T = props.T, day = props.day, month = props.month, year = props.year, text = props.text, setText = props.setText, onSave = props.onSave, onClose = props.onClose;
  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 4 }}>Day Note</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>{MONTHS[month]} {day}, {year}</div>
      <textarea
        value={text}
        onChange={function(e) { setText(e.target.value); }}
        placeholder="How did this day go? What did you accomplish?"
        rows={5}
        style={{ width: "100%", background: T.elevated, border: "1px solid " + T.border, color: T.text, borderRadius: 9, padding: "11px 13px", fontSize: 13, resize: "vertical", lineHeight: 1.65, outline: "none", marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid " + T.border, color: T.textSub, padding: "11px", borderRadius: 10, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Cancel</button>
        <button onClick={onSave} style={{ flex: 2, background: "linear-gradient(135deg," + T.purple + "," + T.purpleLight + ")", border: "none", color: "#fff", padding: "11px", borderRadius: 10, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700 }}>Save Note</button>
      </div>
    </div>
  );
}

function ModalOverlay(props) {
  var T = props.T, children = props.children, onClose = props.onClose;
  return (
    <div
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", animation: "fadeIn 0.15s ease" }}
    >
      <div style={{ background: T.card, borderRadius: 18, padding: 24, width: "100%", maxWidth: 480, border: "1px solid " + T.border, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "slideUp 0.22s ease" }}>
        {children}
      </div>
    </div>
  );
}

function Label(props) {
  var T = props.T, children = props.children;
  return <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>{children}</div>;
}

// ══════════════════════════════════════════════
//  GLOBAL STYLES
// ══════════════════════════════════════════════
function InlineStyles(props) {
  var T = props.T;
  var css = [
    "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap');",
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "::-webkit-scrollbar { width: 3px; height: 3px; }",
    "::-webkit-scrollbar-track { background: transparent; }",
    "::-webkit-scrollbar-thumb { background: " + T.border + "; border-radius: 3px; }",
    "input[type=range] { height: 4px; border-radius: 2px; appearance: none; -webkit-appearance: none; background: " + T.border + "; }",
    "input[type=range]::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: " + T.purple + "; cursor: pointer; border: 2px solid " + T.card + "; }",
    ".hrow { transition: background 0.12s; animation: rowIn 0.28s ease both; }",
    ".hrow:hover { background: " + T.cardHover + " !important; }",
    "input:focus, textarea:focus { border-color: " + T.purple + " !important; outline: none; }",
    "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }",
    "@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }",
    "@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }",
    "@keyframes rowIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }",
    "@keyframes spin { to { transform: rotate(360deg); } }",
  ].join(" ");
  return <style>{css}</style>;
}
