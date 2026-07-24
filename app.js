/* ============================================================
   Daily Reminder App — application logic (vanilla JS, no build)
   ------------------------------------------------------------
   All data is stored in localStorage; nothing leaves the device.
   Sections:
     1. Constants & templates
     2. State + persistence
     3. Time helpers
     4. Rendering (now-card, next-up, timeline)
     5. Add/Edit/Delete + checklist
     6. Templates modal
     7. Settings (theme, notifications, export/import/share/reset)
     8. Notifications + sound
     9. Midnight reset + tick loop
    10. Share-link import + init
   ============================================================ */

/* ---------- 1. Constants & templates ---------- */

// Named colors → hex (WCAG-friendly, used for the left border of each row)
const COLORS = {
  purple: "#8b5cf6", orange: "#f97316", blue: "#3b82f6", cyan: "#06b6d4",
  green: "#22c55e", yellow: "#eab308", pink: "#ec4899", lightblue: "#38bdf8",
  gray: "#6b7280", darkgray: "#374151", red: "#ef4444", teal: "#14b8a6",
};

// Day-of-week indexes match JavaScript's Date.getDay() (0 = Sunday).
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

const TEMPLATES = [
  {
    name: "KSA Work Schedule (12-Hour Shift)",
    desc: "Prayer, a 12-hour shift, evening wind-down.",
    reminders: [
      { time: "06:00", activity: "Prayer + Tamil Worship", duration: "15 min", color: "purple" },
      { time: "06:15", activity: "Get Ready + Breakfast", duration: "15 min", color: "orange" },
      { time: "06:30", activity: "Work (12-Hour Shift)", duration: "12 hours", color: "blue" },
      { time: "18:30", activity: "Commute Home + Worship Podcast", duration: "15 min", color: "cyan" },
      { time: "18:45", activity: "Cooking & Eat", duration: "1.5 hours", color: "green" },
      { time: "20:15", activity: "Decompress/Rest (Walk, Pray, Breathe)", duration: "30 min", color: "yellow" },
      { time: "20:45", activity: "Talk to GF", duration: "30 min", color: "pink" },
      { time: "21:15", activity: "YouTube/Personal Time", duration: "30 min", color: "lightblue" },
      { time: "21:45", activity: "Worship/Prayer/Reflection", duration: "45 min", color: "purple" },
      { time: "22:30", activity: "Wind-Down + Sleep Prep", duration: "30 min", color: "gray" },
      { time: "23:00", activity: "Sleep", duration: "7 hours", color: "darkgray" },
    ],
  },
  {
    name: "Student Schedule",
    desc: "Study blocks, breaks, and evening reflection.",
    reminders: [
      { time: "06:30", activity: "Morning Prayer/Meditation", duration: "15 min", color: "purple" },
      { time: "07:00", activity: "Breakfast + Get Ready", duration: "30 min", color: "orange" },
      { time: "08:00", activity: "Study Block 1", duration: "2 hours", color: "blue" },
      { time: "10:00", activity: "Break + Snack", duration: "15 min", color: "cyan" },
      { time: "10:15", activity: "Study Block 2", duration: "2 hours", color: "blue" },
      { time: "12:15", activity: "Lunch", duration: "45 min", color: "green" },
      { time: "13:00", activity: "Study Block 3 (Weak Areas)", duration: "1.5 hours", color: "blue" },
      { time: "14:30", activity: "Exercise/Walk", duration: "45 min", color: "yellow" },
      { time: "15:15", activity: "Personal Time (YouTube, Gaming)", duration: "1 hour", color: "lightblue" },
      { time: "16:15", activity: "Dinner Prep & Eat", duration: "1 hour", color: "green" },
      { time: "17:15", activity: "Project Work / Assignment", duration: "1.5 hours", color: "orange" },
      { time: "18:45", activity: "Evening Worship/Reflection", duration: "30 min", color: "purple" },
      { time: "19:15", activity: "Wind-Down + Sleep Prep", duration: "1 hour", color: "gray" },
      { time: "20:15", activity: "Sleep", duration: "8 hours", color: "darkgray" },
    ],
  },
  {
    // Work blocks default to weekdays only so this template demonstrates recurrence.
    name: "9-to-5 Office Worker",
    desc: "Commute, focused work blocks, family time. Work blocks are Mon-Fri.",
    reminders: [
      { time: "06:00", activity: "Morning Routine & Prayer", duration: "45 min", color: "purple" },
      { time: "06:45", activity: "Commute to Office", duration: "30 min", color: "cyan", days: WEEKDAYS },
      { time: "09:00", activity: "Work Block 1", duration: "3 hours", color: "blue", days: WEEKDAYS },
      { time: "12:00", activity: "Lunch Break", duration: "1 hour", color: "green", days: WEEKDAYS },
      { time: "13:00", activity: "Work Block 2", duration: "3 hours", color: "blue", days: WEEKDAYS },
      { time: "16:00", activity: "Coffee Break + Walk", duration: "30 min", color: "yellow", days: WEEKDAYS },
      { time: "16:30", activity: "Work Block 3", duration: "1.5 hours", color: "blue", days: WEEKDAYS },
      { time: "17:45", activity: "Commute Home", duration: "30 min", color: "cyan", days: WEEKDAYS },
      { time: "18:15", activity: "Dinner & Family Time", duration: "1.5 hours", color: "orange" },
      { time: "19:45", activity: "Personal Projects / Hobbies", duration: "1 hour", color: "lightblue" },
      { time: "20:45", activity: "Evening Worship/Reading", duration: "30 min", color: "purple" },
      { time: "21:15", activity: "Wind-Down + Sleep Prep", duration: "45 min", color: "gray" },
      { time: "22:00", activity: "Sleep", duration: "8 hours", color: "darkgray" },
    ],
  },
];

// localStorage keys
const LS = {
  reminders: "dailyReminders",
  template: "selectedTemplate",
  prefs: "userPreferences",
  lastReset: "lastResetDate",
  history: "dailyHistory", // { "YYYY-MM-DD": [{id, time, activity, status, startedAt, endedAt}] }
  custom: "customTemplates", // [{ name, desc, reminders: [{time, activity, ...}] }]
};
const HISTORY_KEEP_DAYS = 90;

// Detect the user's browser locale preference for 12/24-hour clock.
function detectTimeFormat() {
  try {
    const s = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2020, 0, 1, 13));
    return /am|pm/i.test(s) ? "12" : "24";
  } catch (e) { return "24"; }
}

/* ---------- 2. State + persistence ---------- */

let state = {
  reminders: [],          // array of reminder objects
  templateName: "",       // name of currently-loaded template
  customTemplates: [],    // user-saved schedules that appear alongside built-ins
  prefs: {
    theme: "auto",
    notificationEnabled: false,
    soundEnabled: true,
    dndStart: null,       // "HH:MM" or null; when set, alerts are silenced within window
    dndEnd: null,
    timeFormat: "auto",   // "auto" | "12" | "24"
  },
};

let nextId = 1;
const genId = () => nextId++;

function loadState() {
  try {
    const r = JSON.parse(localStorage.getItem(LS.reminders) || "null");
    if (Array.isArray(r)) state.reminders = r;
  } catch (e) { /* ignore corrupt data */ }

  state.templateName = localStorage.getItem(LS.template) || "";

  try {
    const p = JSON.parse(localStorage.getItem(LS.prefs) || "null");
    if (p && typeof p === "object") state.prefs = Object.assign(state.prefs, p);
  } catch (e) { /* ignore */ }

  try {
    const c = JSON.parse(localStorage.getItem(LS.custom) || "null");
    if (Array.isArray(c)) state.customTemplates = c;
  } catch (e) { /* ignore */ }

  // Migrate v1 records (boolean `completed`) to the richer status model:
  // upcoming | started | done | skipped, plus actual start/end timestamps.
  // v3 adds days-of-week, notes, preAlertMin, snoozedUntil.
  state.reminders.forEach((r) => {
    if (!r.status) r.status = r.completed ? "done" : "upcoming";
    if (r.startedAt === undefined) r.startedAt = null;
    if (r.endedAt === undefined) r.endedAt = null;
    if (!Array.isArray(r.days)) r.days = ALL_DAYS.slice();
    if (typeof r.notes !== "string") r.notes = "";
    if (typeof r.preAlertMin !== "number") r.preAlertMin = 0;
    if (r.snoozedUntil === undefined) r.snoozedUntil = null;
    delete r.completed;
  });

  // Keep the id counter ahead of any existing ids
  state.reminders.forEach((r) => { if (r.id >= nextId) nextId = r.id + 1; });
  sortReminders();
}

// Debounced writes so rapid edits don't hammer localStorage
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(LS.reminders, JSON.stringify(state.reminders));
    localStorage.setItem(LS.template, state.templateName);
    localStorage.setItem(LS.prefs, JSON.stringify(state.prefs));
    localStorage.setItem(LS.custom, JSON.stringify(state.customTemplates));
  }, 250);
}

function sortReminders() {
  // Reminders are inherently ordered by time of day
  state.reminders.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

/* ---------- 3. Time helpers ---------- */

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}
// Return the user's chosen clock format, resolving "auto" against browser locale.
function activeTimeFormat() {
  const p = state.prefs.timeFormat;
  return p === "12" || p === "24" ? p : detectTimeFormat();
}
// Format an hh:mm pair in the user's preferred clock format.
function fmtHM(h, m) {
  if (activeTimeFormat() === "12") {
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = ((h + 11) % 12) + 1;
    return h12 + ":" + String(m).padStart(2, "0") + " " + ampm;
  }
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function fmtClock(d = new Date()) {
  return fmtHM(d.getHours(), d.getMinutes());
}
// Same but from an "HH:MM" 24-hour string (what reminders store internally).
function fmtStoredTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtHM(h, m);
}
function todayStr(d = new Date()) {
  // Local YYYY-MM-DD (not UTC) so midnight reset matches the user's day
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function humanGap(mins) {
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}
function fmtTs(ts) { return fmtClock(new Date(ts)); }
function elapsedMin(ts) { return Math.max(0, Math.floor((Date.now() - ts) / 60000)); }
// "1.5 hours" / "45 min" → minutes (used for actual-vs-planned progress)
function parseDurationMin(d) {
  if (!d) return null;
  let t = 0;
  const h = d.match(/([\d.]+)\s*h/i);
  const m = d.match(/(\d+)\s*m/i);
  if (h) t += parseFloat(h[1]) * 60;
  if (m) t += parseInt(m[1], 10);
  return t || null;
}
function dowToday(d = new Date()) { return d.getDay(); }
// Does this reminder apply on the given day-of-week? Empty days array = every day.
function appliesOn(r, dow) { return !r.days || !r.days.length || r.days.includes(dow); }
function appliesToday(r) { return appliesOn(r, dowToday()); }

// Compute the end-time of a reminder from its start + parsed duration.
// Returns a display string (respects 12/24-hour pref) or null.
function endTimeStr(r) {
  const mins = parseDurationMin(r.duration);
  if (!mins) return null;
  const end = (toMinutes(r.time) + mins) % (24 * 60);
  return fmtHM(Math.floor(end / 60), end % 60);
}

// A short human badge for the days-of-week (e.g. "Mon–Fri", "Weekends", "MWF").
function daysBadge(days) {
  if (!days || days.length === 0 || days.length === 7) return null;
  const sorted = days.slice().sort((a, b) => a - b);
  if (sorted.join() === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.join() === "0,6") return "Weekends";
  return sorted.map((d) => DAY_LETTER[d]).join("");
}

// Does this reminder overlap in time (today) with any other applicable one?
function hasOverlap(r) {
  const s = toMinutes(r.time);
  const dur = parseDurationMin(r.duration);
  if (!dur) return false;
  const e = s + dur;
  return state.reminders.some((o) => {
    if (o.id === r.id || !appliesToday(o)) return false;
    const os = toMinutes(o.time);
    const od = parseDurationMin(o.duration);
    // Compare as time blocks. If no duration on the other, treat as instant.
    const oe = od ? os + od : os;
    return s < oe && os < e;
  });
}

// Is the current minute-of-day inside the user's DND window? Handles cross-midnight.
function isInDND(now = nowMinutes()) {
  const { dndStart, dndEnd } = state.prefs;
  if (!dndStart || !dndEnd) return false;
  const s = toMinutes(dndStart), e = toMinutes(dndEnd);
  if (s === e) return false;
  return s < e ? (now >= s && now < e) : (now >= s || now < e);
}

// Given the sorted list, find which reminder is "current" (most recent past one)
// and the list of upcoming ones for today. Filters by per-reminder days-of-week.
function computeCurrentAndNext() {
  const now = nowMinutes();
  let current = null;
  const upcoming = [];
  for (const r of state.reminders) {
    if (!appliesToday(r)) continue;
    const t = toMinutes(r.time);
    if (t <= now) current = r;      // last one that has already started
    else upcoming.push(r);          // still to come today
  }
  return { current, upcoming };
}

// The reminders that apply today, in time order. Used by the timeline.
function todaysReminders() {
  return state.reminders.filter(appliesToday);
}

// Minutes until the current activity ends = start of the next reminder.
function currentWindow(current, upcoming) {
  if (!current) return null;
  const start = toMinutes(current.time);
  const end = upcoming.length ? toMinutes(upcoming[0].time) : 24 * 60;
  return { start, end, total: end - start };
}

/* ---------- 4. Rendering ---------- */

const $ = (id) => document.getElementById(id);

function render() {
  renderNow();
  renderNextUp();
  renderTimeline();
  renderCompletion();
  $("templateBadge").textContent = state.templateName || "";
}

function renderNow() {
  $("nowClock").textContent = fmtClock();
  const { current, upcoming } = computeCurrentAndNext();
  const running = runningTask();
  $("nowActions").hidden = !running;
  $("nowEndBtn").hidden = !running;
  $("nowFocusBtn").hidden = !running;
  if (running && !$("focusOverlay").hidden) updateFocus(running);

  if (running) {
    // A task is actively being tracked — show actual elapsed time.
    $("nowActivity").textContent = running.activity;
    const mins = elapsedMin(running.startedAt);
    $("nowMeta").textContent =
      `started ${fmtTs(running.startedAt)} · ${mins} min elapsed` +
      (running.duration ? ` · planned ${running.duration}` : "");
    const planned = parseDurationMin(running.duration);
    $("nowProgressFill").style.width =
      (planned ? Math.min(100, Math.round((mins / planned) * 100)) : 0) + "%";
    return;
  }

  if (!current) {
    $("nowActivity").textContent = upcoming.length ? "Nothing yet — first up soon" : "No activity right now";
    $("nowMeta").textContent = upcoming.length ? `${upcoming[0].activity} at ${fmtStoredTime(upcoming[0].time)}` : "";
    $("nowProgressFill").style.width = "0%";
    return;
  }

  $("nowActivity").textContent = current.activity;
  const win = currentWindow(current, upcoming);
  const elapsed = nowMinutes() - win.start;
  const remaining = win.end - nowMinutes();
  const pct = win.total > 0 ? Math.min(100, Math.round((elapsed / win.total) * 100)) : 0;
  $("nowProgressFill").style.width = pct + "%";
  $("nowMeta").textContent =
    `${elapsed} min elapsed · ${remaining} min left` + (current.duration ? ` · planned ${current.duration}` : "");
}

function renderNextUp() {
  const { upcoming } = computeCurrentAndNext();
  const list = $("nextUpList");
  list.innerHTML = "";
  if (!upcoming.length) {
    list.innerHTML = `<li class="nextup-empty">Nothing left scheduled today 🎉</li>`;
    return;
  }
  const now = nowMinutes();
  upcoming.slice(0, 3).forEach((r) => {
    const li = document.createElement("li");
    li.className = "nextup-item";
    li.style.setProperty("--rc", COLORS[r.color] || COLORS.gray);
    li.innerHTML = `
      <span class="nextup-time">${fmtStoredTime(r.time)}</span>
      <span class="nextup-name">${escapeHtml(r.activity)}</span>
      <span class="nextup-in">${humanGap(toMinutes(r.time) - now)}</span>`;
    list.appendChild(li);
  });
}

// Only rebuild the timeline DOM when something that affects it actually
// changed. The 15s tick calls render() constantly; without this guard it
// would churn the DOM every tick and could swallow a tap mid-rebuild.
let lastTimelineSig = null;

function renderTimeline() {
  const { current } = computeCurrentAndNext();
  const rendered = todaysReminders();
  const sig = JSON.stringify({
    c: current ? current.id : 0,
    m: selectMode,
    sel: Array.from(selected),
    r: rendered.map((r) => [
      r.id, r.time, r.activity, r.duration, r.color, r.status,
      r.status === "started" ? elapsedMin(r.startedAt) : 0, r.startedAt, r.endedAt,
      r.notes, r.preAlertMin, (r.days || []).join(","), r.snoozedUntil,
    ]),
  });
  if (sig === lastTimelineSig) return; // nothing changed → leave the DOM alone
  lastTimelineSig = sig;

  const list = $("timelineList");
  list.innerHTML = "";
  const anyToday = rendered.length > 0;
  const anyAtAll = state.reminders.length > 0;
  $("emptyHint").hidden = anyAtAll;
  if (anyAtAll && !anyToday) {
    // No reminders scheduled for today — but the schedule isn't empty
    const li = document.createElement("li");
    li.className = "empty-hint";
    li.style.padding = "20px 4px";
    li.style.textAlign = "center";
    li.style.color = "var(--text-dim)";
    li.textContent = `No reminders scheduled for ${DAY_SHORT[dowToday()]}.`;
    list.appendChild(li);
    return;
  }

  rendered.forEach((r) => {
    // A wrapper is needed for swipe: it clips the reveal-behind action layers.
    const wrap = document.createElement("li");
    wrap.className = "reminder-wrap";
    wrap.innerHTML = `
      <div class="swipe-action done">✓ Done</div>
      <div class="swipe-action delete">Delete</div>`;

    const li = document.createElement("div");
    li.className = "reminder"
      + (r.status === "done" ? " done" : "")
      + (r.status === "skipped" ? " skipped" : "")
      + (r.status === "started" ? " running" : "")
      + (current && current.id === r.id ? " current" : "")
      + (selectMode && selected.has(r.id) ? " selected" : "");
    li.style.setProperty("--rc", COLORS[r.color] || COLORS.gray);

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "reminder-check";
    check.checked = r.status === "done";
    check.setAttribute("aria-label", "Mark complete");
    check.addEventListener("change", () => quickToggle(r.id, check.checked));

    const body = document.createElement("div");
    body.className = "reminder-body";
    const isCurrent = current && current.id === r.id;
    const end = endTimeStr(r);
    const overlap = hasOverlap(r) && r.status !== "done" && r.status !== "skipped";
    const streak = computeStreak(r.id);
    const badge = daysBadge(r.days);
    body.innerHTML = `
      <div class="reminder-time">
        ${fmtStoredTime(r.time)}${end ? ` <span class="reminder-endtime">→ ${end}</span>` : ""}
        ${isCurrent ? '<span class="current-tag">now</span>' : ""}
        ${r.status === "started" ? '<span class="running-tag">running</span>' : ""}
      </div>
      <div class="reminder-name">${escapeHtml(r.activity)}</div>
      ${r.duration ? `<div class="reminder-dur">${escapeHtml(r.duration)}</div>` : ""}
      ${r.notes ? `<div class="reminder-notes">${escapeHtml(r.notes)}</div>` : ""}
      ${actualLine(r)}
      ${(badge || overlap || streak >= 3 || r.preAlertMin > 0 || r.snoozedUntil) ? `
        <div class="reminder-tags">
          ${badge ? `<span class="tag days">${badge}</span>` : ""}
          ${overlap ? `<span class="tag overlap" title="Overlaps with another reminder">⚠ overlap</span>` : ""}
          ${streak >= 3 ? `<span class="tag streak">🔥 ${streak}d streak</span>` : ""}
          ${r.preAlertMin > 0 ? `<span class="tag prealert">−${r.preAlertMin}m</span>` : ""}
          ${r.snoozedUntil ? `<span class="tag prealert">💤 ${fmtTs(r.snoozedUntil)}</span>` : ""}
        </div>` : ""}`;
    body.addEventListener("click", () => (selectMode ? toggleSelect(r.id) : openEdit(r.id)));
    attachLongPress(li, r.id);
    attachSwipe(wrap, li, r.id);

    // Right side: Start/End action (hidden while multi-selecting)
    const side = document.createElement("div");
    side.className = "reminder-side";
    if (!selectMode) {
      if (r.status === "upcoming") {
        const b = document.createElement("button");
        b.className = "task-btn start";
        b.textContent = "Start";
        b.addEventListener("click", () => startTask(r.id));
        side.appendChild(b);
      } else if (r.status === "started") {
        const b = document.createElement("button");
        b.className = "task-btn end";
        b.textContent = "End";
        b.addEventListener("click", () => endTask(r.id));
        side.appendChild(b);
      } else if (r.status === "skipped") {
        side.innerHTML = '<span class="skip-label">skipped</span>';
      }
    }

    li.append(check, body, side);
    wrap.appendChild(li);
    list.appendChild(wrap);
  });
}

// One-line "actual vs planned" note under a task.
function actualLine(r) {
  if (r.status === "started" && r.startedAt)
    return `<div class="reminder-actual">started ${fmtTs(r.startedAt)} · ${elapsedMin(r.startedAt)} min</div>`;
  if (r.status === "done" && r.startedAt && r.endedAt) {
    const mins = Math.max(1, Math.round((r.endedAt - r.startedAt) / 60000));
    return `<div class="reminder-actual">actual ${fmtTs(r.startedAt)}–${fmtTs(r.endedAt)} · ${mins} min</div>`;
  }
  return "";
}

function renderCompletion() {
  // Count only what applies today so the counter is meaningful.
  const today = todaysReminders();
  const total = today.length;
  const done = today.filter((r) => r.status === "done").length;
  const skipped = today.filter((r) => r.status === "skipped").length;
  $("completionPct").textContent = !total ? "0/0 done"
    : skipped ? `${done}✓ · ${skipped}⤼ · ${total - done - skipped} left`
    : `${done}/${total} done`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- 5. Add / Edit / Delete + checklist ---------- */

let editingId = null; // null = adding new

function populateColorSelect() {
  const sel = $("fldColor");
  sel.innerHTML = "";
  Object.keys(COLORS).forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    sel.appendChild(opt);
  });
}

function setDaysUI(days) {
  document.querySelectorAll("#fldDays button").forEach((b) => {
    b.classList.toggle("on", days.includes(+b.dataset.d));
  });
}
function getDaysUI() {
  return Array.from(document.querySelectorAll("#fldDays button.on")).map((b) => +b.dataset.d);
}

function openEdit(id) {
  editingId = id;
  const r = state.reminders.find((x) => x.id === id);
  $("editTitle").textContent = "Edit reminder";
  $("fldTime").value = r.time;
  $("fldActivity").value = r.activity;
  $("fldDuration").value = r.duration || "";
  $("fldColor").value = COLORS[r.color] ? r.color : "gray";
  $("fldNotes").value = r.notes || "";
  $("fldPreAlert").value = String(r.preAlertMin || 0);
  setDaysUI(r.days && r.days.length ? r.days : ALL_DAYS);
  $("fldNotify").checked = !!r.notificationEnabled;
  $("fldSound").checked = !!r.soundEnabled;
  $("deleteReminderBtn").hidden = false;
  showModal("editModal");
}

function openAdd() {
  editingId = null;
  const now = new Date();
  $("editTitle").textContent = "Add reminder";
  $("fldTime").value = fmtClock(now);
  $("fldActivity").value = "";
  $("fldDuration").value = "";
  $("fldColor").value = "blue";
  $("fldNotes").value = "";
  $("fldPreAlert").value = "0";
  setDaysUI(ALL_DAYS);
  $("fldNotify").checked = true;
  $("fldSound").checked = true;
  $("deleteReminderBtn").hidden = true;
  showModal("editModal");
  setTimeout(() => $("fldActivity").focus(), 100);
}

function submitEdit(e) {
  e.preventDefault();
  const days = getDaysUI();
  const data = {
    time: $("fldTime").value,
    activity: $("fldActivity").value.trim(),
    duration: $("fldDuration").value.trim(),
    color: $("fldColor").value,
    notes: $("fldNotes").value.trim(),
    preAlertMin: parseInt($("fldPreAlert").value, 10) || 0,
    days: days.length ? days : ALL_DAYS.slice(), // empty = every day
    notificationEnabled: $("fldNotify").checked,
    soundEnabled: $("fldSound").checked,
  };
  if (!data.time || !data.activity) return;

  if (editingId == null) {
    state.reminders.push(Object.assign(
      { id: genId(), status: "upcoming", startedAt: null, endedAt: null, snoozedUntil: null },
      data
    ));
  } else {
    const r = state.reminders.find((x) => x.id === editingId);
    Object.assign(r, data);
  }
  sortReminders();
  saveState();
  render();
  hideModal("editModal");
  toast(editingId == null ? "Reminder added" : "Saved");
}

function deleteReminder() {
  if (editingId == null) return;
  const removed = state.reminders.find((x) => x.id === editingId);
  const idx = state.reminders.indexOf(removed);
  state.reminders = state.reminders.filter((x) => x.id !== editingId);
  saveState();
  render();
  hideModal("editModal");
  // Offer undo so an accidental delete is recoverable for a few seconds.
  showUndo(`Deleted "${removed.activity}"`, () => {
    state.reminders.splice(idx, 0, removed);
    sortReminders();
    saveState();
    render();
  });
}

// Checkbox quick-toggle: done ↔ upcoming (unchecking clears the tracked times).
function quickToggle(id, checked) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  if (checked) {
    if (r.status === "started") r.endedAt = Date.now();
    r.status = "done";
  } else {
    r.status = "upcoming";
    r.startedAt = null;
    r.endedAt = null;
  }
  vibrate();
  saveState();
  render();
}

/* ---------- 6. Templates ---------- */

// Merged list: built-in templates first, then the user's custom templates.
// Indexes into this list are what applyTemplate() and the DOM data-i use.
function allTemplates() {
  const custom = state.customTemplates.map((t) => Object.assign({}, t, { custom: true }));
  return TEMPLATES.concat(custom);
}

function renderTemplateList() {
  const wrap = $("templateList");
  wrap.innerHTML = "";
  allTemplates().forEach((tmpl, i) => {
    const card = document.createElement("div");
    card.className = "template-card" + (tmpl.custom ? " custom" : "");
    card.innerHTML = `
      <div class="tc-head">
        <h3>${escapeHtml(tmpl.name)}${tmpl.custom ? " ★" : ""}</h3>
        ${tmpl.custom ? `<button class="tc-delete" data-del="${escapeHtml(tmpl.name)}" title="Delete template">✕</button>` : ""}
      </div>
      <p>${escapeHtml(tmpl.desc || "")} · ${tmpl.reminders.length} reminders</p>
      <div class="tc-actions">
        <button class="action-btn primary" data-act="replace" data-i="${i}">Load &amp; Replace</button>
        <button class="action-btn" data-act="merge" data-i="${i}">Merge</button>
      </div>`;
    wrap.appendChild(card);
  });
  wrap.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => applyTemplate(+btn.dataset.i, btn.dataset.act));
  });
  wrap.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCustomTemplate(btn.dataset.del));
  });
}

function makeReminderFromTemplate(t) {
  return {
    id: genId(),
    time: t.time,
    activity: t.activity,
    duration: t.duration || "",
    color: COLORS[t.color] ? t.color : "gray",
    notes: t.notes || "",
    days: Array.isArray(t.days) && t.days.length ? t.days.slice() : ALL_DAYS.slice(),
    preAlertMin: typeof t.preAlertMin === "number" ? t.preAlertMin : 0,
    notificationEnabled: true,
    soundEnabled: true,
    status: "upcoming",
    startedAt: null,
    endedAt: null,
    snoozedUntil: null,
  };
}

function applyTemplate(index, mode) {
  const tmpl = allTemplates()[index];
  if (!tmpl) return;
  const fresh = tmpl.reminders.map(makeReminderFromTemplate);
  if (mode === "replace") {
    state.reminders = fresh;
    state.templateName = tmpl.name;
  } else {
    state.reminders = state.reminders.concat(fresh);
    state.templateName = state.templateName ? state.templateName + " + " + tmpl.name : tmpl.name;
  }
  sortReminders();
  saveState();
  render();
  hideModal("templateModal");
  toast(mode === "replace" ? "Template loaded" : "Template merged");
}

/* ---------- 7. Settings ---------- */

function applyTheme() {
  const t = state.prefs.theme;
  const html = document.documentElement;
  if (t === "auto") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", t);
  // Reflect selection in the segmented control
  document.querySelectorAll("#themeSegmented .seg").forEach((b) =>
    b.classList.toggle("active", b.dataset.theme === t));
}

function openSettings() {
  $("setNotify").checked = state.prefs.notificationEnabled;
  $("setSound").checked = state.prefs.soundEnabled;
  $("setDndStart").value = state.prefs.dndStart || "";
  $("setDndEnd").value = state.prefs.dndEnd || "";
  applyTheme();
  applyTimeFormat();
  showModal("settingsModal");
}

// Reflect the current time-format pref on the segmented control.
function applyTimeFormat() {
  const f = state.prefs.timeFormat || "auto";
  document.querySelectorAll("#timeFmtSegmented .seg").forEach((b) =>
    b.classList.toggle("active", b.dataset.fmt === f));
}

async function setNotifications(on) {
  if (on && "Notification" in window && Notification.permission !== "granted") {
    const res = await Notification.requestPermission();
    if (res !== "granted") {
      on = false;
      $("setNotify").checked = false;
      toast("Notifications blocked in browser settings");
    }
  }
  state.prefs.notificationEnabled = on;
  saveState();
}

// Download a file with the given filename and JSON payload.
function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Just the current schedule (portable — same format Import understands).
function exportSchedule() {
  downloadJSON("daily-schedule.json", {
    name: state.templateName || "My Schedule",
    reminders: state.reminders,
  });
  toast("Schedule downloaded");
}

// Full backup: schedule + all history + preferences + custom templates.
// Wrapped in an envelope so Import can recognize it as a "backup" vs plain schedule.
function backupAll() {
  const payload = {
    type: "daily-reminder-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    schedule: {
      name: state.templateName || "My Schedule",
      reminders: state.reminders,
    },
    history: historyLoad(),
    prefs: state.prefs,
    customTemplates: state.customTemplates,
  };
  const dateStr = todayStr();
  downloadJSON(`daily-reminder-backup-${dateStr}.json`, payload);
  const histDays = Object.keys(payload.history).length;
  toast(`Backup saved (${state.reminders.length} tasks, ${histDays} days of history)`);
}

// Import handles both a plain schedule OR a full backup envelope.
function importSchedule(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data && data.type === "daily-reminder-backup") {
        // Full-backup restore
        if (!confirm("Restore full backup? This overwrites your current schedule, history, preferences, and custom templates.")) return;
        if (data.schedule && Array.isArray(data.schedule.reminders)) {
          state.reminders = data.schedule.reminders.map(makeReminderFromTemplate);
          state.templateName = data.schedule.name || "Restored";
        }
        if (data.history && typeof data.history === "object") historySave(data.history);
        if (data.prefs && typeof data.prefs === "object") state.prefs = Object.assign(state.prefs, data.prefs);
        if (Array.isArray(data.customTemplates)) state.customTemplates = data.customTemplates;
        sortReminders();
        saveState();
        render();
        applyTheme();
        hideModal("settingsModal");
        const histDays = Object.keys(data.history || {}).length;
        toast(`Restored (${state.reminders.length} tasks, ${histDays} days of history)`);
        return;
      }
      // Plain schedule import
      const arr = Array.isArray(data) ? data : data.reminders;
      if (!Array.isArray(arr)) throw new Error("bad");
      state.reminders = arr.map(makeReminderFromTemplate);
      state.templateName = (data && data.name) || "Imported";
      sortReminders();
      saveState();
      render();
      hideModal("settingsModal");
      toast("Schedule imported");
    } catch (e) {
      toast("Could not read that file");
    }
  };
  reader.readAsText(file);
}

// Save the current schedule as a reusable custom template. Prompts for a name.
function saveScheduleAsTemplate() {
  if (!state.reminders.length) { toast("Nothing to save"); return; }
  const suggested = state.templateName || "My Schedule";
  const name = (window.prompt("Name this template:", suggested) || "").trim();
  if (!name) return;
  // Overwrite an existing same-name template if the user confirms.
  const existing = state.customTemplates.findIndex((t) => t.name === name);
  if (existing >= 0 && !confirm(`Replace existing template "${name}"?`)) return;
  const tmpl = {
    name,
    desc: `Saved ${todayStr()}`,
    custom: true,
    reminders: state.reminders.map((r) => ({
      time: r.time, activity: r.activity, duration: r.duration, color: r.color,
      notes: r.notes, days: r.days, preAlertMin: r.preAlertMin,
    })),
  };
  if (existing >= 0) state.customTemplates[existing] = tmpl;
  else state.customTemplates.push(tmpl);
  saveState();
  toast(`Saved template: ${name}`);
}

function deleteCustomTemplate(name) {
  if (!confirm(`Delete template "${name}"?`)) return;
  state.customTemplates = state.customTemplates.filter((t) => t.name !== name);
  saveState();
  renderTemplateList();
  toast("Template deleted");
}

function shareLink() {
  // Encode the schedule into a URL fragment (#s=...) — stays out of server logs.
  const payload = { name: state.templateName || "Shared Schedule", reminders: state.reminders.map(stripReminder) };
  const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  const url = location.origin + location.pathname + "#s=" + encoded;
  copyText(url);
}

function stripReminder(r) {
  // Only the fields worth sharing (drop id/completed)
  return { time: r.time, activity: r.activity, duration: r.duration, color: r.color };
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast("Link copied"), () => promptCopy(text));
  } else {
    promptCopy(text);
  }
}
function promptCopy(text) { window.prompt("Copy this share link:", text); }

function wipeAll() {
  if (!confirm("Delete all reminders and reset the app?")) return;
  state.reminders = [];
  state.templateName = "";
  saveState();
  render();
  hideModal("settingsModal");
  toast("Reset complete");
}

/* ---------- 8. Notifications + sound ---------- */

// Track which reminder times we've already fired today to avoid repeats.
let firedToday = new Set();

function beep() {
  // Generate a short chime with the Web Audio API — no sound file needed (works offline).
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  } catch (e) { /* audio not available */ }
}

// Show a notification via the SW registration so we can attach action
// buttons ("Start", "Snooze 5", "Skip"). Chromium/Android renders them;
// iOS Safari silently ignores actions but still shows the notification.
async function showRichNotification(r, opts) {
  const body = opts.body;
  const tag = opts.tag || "reminder-" + r.id;
  const useSW = "serviceWorker" in navigator;
  if (useSW) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(opts.title, {
          body,
          tag,
          icon: "icons/icon-192.png",
          badge: "icons/icon-192.png",
          data: { id: r.id },
          actions: [
            { action: "start", title: "Start" },
            { action: "snooze-5", title: "+5 min" },
            { action: "skip", title: "Skip" },
          ],
        });
        return;
      }
    } catch (e) { /* fall through to constructor */ }
  }
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(opts.title, { body, tag, icon: "icons/icon-192.png" }); } catch (e) { /* ignore */ }
  }
}

function fireReminder(r) {
  // On-screen flash — always happens, even during DND.
  const card = $("nowCard");
  card.classList.remove("flash");
  void card.offsetWidth; // restart animation
  card.classList.add("flash");

  const isSleep = /sleep/i.test(r.activity);
  const silent = isSleep || isInDND();

  if (state.prefs.notificationEnabled && !silent) {
    showRichNotification(r, {
      title: r.activity,
      body: `${r.time}${r.duration ? " · " + r.duration : ""}${r.notes ? " — " + r.notes.slice(0, 80) : ""}`,
    });
  }
  if (state.prefs.soundEnabled && r.soundEnabled && !silent) beep();
}

function firePreAlert(r) {
  const silent = isInDND();
  if (state.prefs.notificationEnabled && !silent) {
    showRichNotification(r, {
      title: `Coming up: ${r.activity}`,
      body: `In ${r.preAlertMin} min at ${r.time}${r.duration ? " · " + r.duration : ""}`,
      tag: "pre-" + r.id,
    });
  }
  if (state.prefs.soundEnabled && r.soundEnabled && !silent) beep();
}

function checkDueReminders() {
  const now = nowMinutes();
  const nowMs = Date.now();
  state.reminders.forEach((r) => {
    if (!r.notificationEnabled) return;
    if (r.status === "done" || r.status === "skipped") return;
    if (!appliesToday(r)) return;

    // Snooze: re-fire once the snoozedUntil time arrives.
    if (r.snoozedUntil && nowMs >= r.snoozedUntil) {
      const key = r.id + "@snooze-" + r.snoozedUntil;
      if (!firedToday.has(key)) {
        firedToday.add(key);
        fireReminder(r);
        r.snoozedUntil = null;
        saveState();
      }
      return;
    }
    if (r.snoozedUntil) return; // snoozed but not yet due — don't fire the scheduled one

    const t = toMinutes(r.time);

    // Pre-alert: fire N min before the scheduled time.
    if (r.preAlertMin > 0) {
      const preT = t - r.preAlertMin;
      const preKey = r.id + "@pre-" + preT;
      if (now === preT && !firedToday.has(preKey)) {
        firedToday.add(preKey);
        firePreAlert(r);
      }
    }

    // Main alert at scheduled time.
    const key = r.id + "@" + r.time;
    if (now === t && !firedToday.has(key)) {
      firedToday.add(key);
      fireReminder(r);
    }
  });
}

// Snooze the current reminder by N minutes. Sets snoozedUntil which
// checkDueReminders will pick up. Called by SW-action postMessage or in-app.
function snoozeReminder(id, minutes) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  r.snoozedUntil = Date.now() + minutes * 60000;
  saveState();
  render();
  toast(`Snoozed ${minutes} min`);
}

// Skip via notification action.
function skipReminder(id) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  const prev = r.status;
  r.status = "skipped";
  saveState();
  render();
  showUndo(`Skipped "${r.activity}"`, () => { r.status = prev; saveState(); render(); });
}

/* ---------- 9. Midnight reset + tick loop ---------- */

function maybeMidnightReset() {
  const today = todayStr();
  const last = localStorage.getItem(LS.lastReset);
  if (last && last !== today) {
    // Snapshot yesterday's results into history BEFORE we wipe them.
    snapshotDay(last);
  }
  if (last !== today) {
    // New day: reset every task to upcoming and clear the "already fired" tracker.
    state.reminders.forEach((r) => {
      r.status = "upcoming"; r.startedAt = null; r.endedAt = null; r.snoozedUntil = null;
    });
    firedToday = new Set();
    localStorage.setItem(LS.lastReset, today);
    saveState();
  }
}

function tick() {
  maybeMidnightReset();
  checkDueReminders();
  render();
}

/* ---------- 10. Share-link import + init ---------- */

function importFromUrlIfPresent() {
  const m = location.hash.match(/[#&]s=([^&]+)/);
  if (!m) return false;
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
    const data = JSON.parse(json);
    if (data && Array.isArray(data.reminders)) {
      if (state.reminders.length && !confirm(`Load shared schedule "${data.name}"? This replaces your current one.`)) {
        history.replaceState(null, "", location.pathname);
        return false;
      }
      state.reminders = data.reminders.map(makeReminderFromTemplate);
      state.templateName = data.name || "Shared Schedule";
      sortReminders();
      saveState();
      history.replaceState(null, "", location.pathname); // clean the URL
      return true;
    }
  } catch (e) { /* ignore malformed link */ }
  return false;
}

/* ---------- Task flow: start/end, catch-up, next prompt, summary ---------- */

let selectMode = false;
const selected = new Set();
let pendingStartId = null;
let pendingNextId = null;

function findRem(id) { return state.reminders.find((x) => x.id === id); }
function runningTask() { return state.reminders.find((x) => x.status === "started"); }

// Haptic tap where supported (Android; iOS doesn't expose vibration to web apps).
function vibrate(ms = 15) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ }
}

// Start a task. If earlier tasks were never marked, offer the catch-up sheet first.
function startTask(id) {
  const target = findRem(id);
  if (!target) return;
  const earlier = state.reminders.filter(
    (x) => x.status === "upcoming" && x.id !== id && toMinutes(x.time) < toMinutes(target.time)
  );
  if (earlier.length) { openCatchUp(earlier, id); return; }
  reallyStart(id);
}

function reallyStart(id) {
  // Only one task runs at a time — end any other running task first.
  const running = runningTask();
  if (running && running.id !== id) {
    running.status = "done";
    running.endedAt = Date.now();
    toast(`Ended: ${running.activity}`);
  }
  const r = findRem(id);
  r.status = "started";
  r.startedAt = Date.now();
  r.endedAt = null;
  vibrate();
  saveState();
  render();
}

function endTask(id) {
  const r = findRem(id);
  if (!r || r.status !== "started") return;
  r.status = "done";
  r.endedAt = Date.now();
  vibrate(30);
  saveState();
  render();

  // Offer to start the next upcoming task, or show the day summary.
  const idx = state.reminders.indexOf(r);
  const next = state.reminders.slice(idx + 1).find((x) => x.status === "upcoming");
  if (next) openNextPrompt(next);
  else if (!state.reminders.some((x) => x.status === "upcoming" || x.status === "started")) openSummary();
}

/* --- catch-up sheet (earlier unmarked tasks: done or skip?) --- */

function openCatchUp(earlier, targetId) {
  pendingStartId = targetId;
  const ul = $("catchupList");
  ul.innerHTML = "";
  earlier.forEach((r) => {
    const li = document.createElement("li");
    li.className = "catchup-item";
    li.innerHTML = `
      <input type="checkbox" class="reminder-check" data-id="${r.id}" id="cu-${r.id}">
      <label for="cu-${r.id}"><b>${r.time}</b> ${escapeHtml(r.activity)}</label>`;
    ul.appendChild(li);
  });
  showModal("catchupModal");
}

function confirmCatchUp() {
  document.querySelectorAll("#catchupList input").forEach((cb) => {
    const r = findRem(+cb.dataset.id);
    if (r && r.status === "upcoming") r.status = cb.checked ? "done" : "skipped";
  });
  hideModal("catchupModal");
  const id = pendingStartId;
  pendingStartId = null;
  if (id != null) reallyStart(id); // saves + renders
}

/* --- "start next?" prompt --- */

function openNextPrompt(next) {
  pendingNextId = next.id;
  $("nextSheetDesc").textContent =
    `${next.activity} · scheduled ${next.time}` + (next.duration ? ` · ${next.duration}` : "");
  showModal("nextSheet");
}

/* --- end-of-day summary --- */

function openSummary() {
  const done = state.reminders.filter((r) => r.status === "done").length;
  const skipped = state.reminders.filter((r) => r.status === "skipped").length;
  let trackedMs = 0;
  state.reminders.forEach((r) => { if (r.startedAt && r.endedAt) trackedMs += r.endedAt - r.startedAt; });
  const h = Math.floor(trackedMs / 3600000), m = Math.round((trackedMs % 3600000) / 60000);
  $("summaryBody").innerHTML = `
    <div class="summary-row"><span>✓ Completed</span><b>${done}</b></div>
    <div class="summary-row"><span>⤼ Skipped</span><b>${skipped}</b></div>
    <div class="summary-row"><span>⏱ Time tracked</span><b>${h ? h + "h " : ""}${m} min</b></div>`;
  showModal("summaryModal");
}

/* --- multi-select mode (bulk done / skip) --- */

function enterSelectMode() {
  selectMode = true;
  selected.clear();
  $("selBar").hidden = false;
  $("mainBar").hidden = true;
  $("selectModeBtn").textContent = "Cancel";
  render();
}

function exitSelectMode() {
  selectMode = false;
  selected.clear();
  $("selBar").hidden = true;
  $("mainBar").hidden = false;
  $("selectModeBtn").textContent = "Select";
  render();
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  render();
}

function bulkMark(status) {
  if (!selected.size) { toast("Nothing selected"); return; }
  const changed = [];
  selected.forEach((id) => {
    const r = findRem(id);
    if (r) {
      changed.push({ r, prev: { status: r.status, startedAt: r.startedAt, endedAt: r.endedAt } });
      if (status === "done" && r.status === "started") r.endedAt = Date.now();
      r.status = status;
    }
  });
  vibrate();
  saveState();
  exitSelectMode(); // also renders
  showUndo(`${changed.length} marked ${status === "done" ? "done" : "skipped"}`, () => {
    changed.forEach(({ r, prev }) => Object.assign(r, prev));
    saveState(); render();
  });
}

// Long-press a task card to enter selection mode (standard mobile pattern).
function attachLongPress(el, id) {
  let timer = null;
  el.addEventListener("pointerdown", () => {
    timer = setTimeout(() => {
      if (!selectMode) enterSelectMode();
      toggleSelect(id);
    }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    el.addEventListener(ev, () => clearTimeout(timer)));
}

/* ---------- History + streaks ---------- */

function historyLoad() {
  try { return JSON.parse(localStorage.getItem(LS.history) || "{}") || {}; }
  catch (e) { return {}; }
}
function historySave(h) { localStorage.setItem(LS.history, JSON.stringify(h)); }

// Save the finished state of `dateStr` to history and prune old entries.
function snapshotDay(dateStr) {
  const h = historyLoad();
  h[dateStr] = state.reminders.filter((r) => appliesOn(r, new Date(dateStr).getDay())).map((r) => ({
    id: r.id,
    time: r.time,
    activity: r.activity,
    status: r.status === "started" ? "upcoming" : r.status, // a task still running at midnight counts as not done
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  }));
  // Prune anything older than HISTORY_KEEP_DAYS.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_KEEP_DAYS);
  const cutoffStr = todayStr(cutoff);
  Object.keys(h).forEach((k) => { if (k < cutoffStr) delete h[k]; });
  historySave(h);
}

// Consecutive days ending yesterday where this reminder was scheduled AND done.
// Days where the reminder wasn't scheduled at all don't break the streak.
function computeStreak(id) {
  const h = historyLoad();
  let streak = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1); // start from yesterday
  for (let i = 0; i < HISTORY_KEEP_DAYS; i++) {
    const day = h[todayStr(d)];
    if (day) {
      const rec = day.find((x) => x.id === id);
      if (rec) {
        if (rec.status === "done") streak++;
        else break; // scheduled but not done → break
      } // not in history for that day (wasn't scheduled) → skip without breaking
    } else {
      break; // no history for this day at all → stop counting
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* ---------- Undo ---------- */

// Simple undo: one recent action is remembered and can be restored via the toast.
let pendingUndo = null;
let undoTimer = null;

function showUndo(message, restore) {
  pendingUndo = { message, restore };
  clearTimeout(undoTimer);
  const el = $("toast");
  $("toastMsg").textContent = message;
  $("toastUndo").hidden = false;
  el.hidden = false;
  undoTimer = setTimeout(() => {
    el.hidden = true;
    $("toastUndo").hidden = true;
    pendingUndo = null;
  }, 5000);
}

function doUndo() {
  if (!pendingUndo) return;
  const { restore } = pendingUndo;
  pendingUndo = null;
  clearTimeout(undoTimer);
  $("toast").hidden = true;
  $("toastUndo").hidden = true;
  try { restore(); } catch (e) { /* ignore */ }
  toast("Undone");
}

/* ---------- Swipe gestures ---------- */

// Left swipe = delete, right swipe = mark done. Threshold-based with visual
// reveal behind the row. Preserves existing tap-to-edit / long-press-select.
const SWIPE_THRESHOLD = 80;

function attachSwipe(wrap, row, id) {
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, direction = 0;
  row.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX = e.clientX; startY = e.clientY; dx = 0;
    dragging = true; decided = false; direction = 0;
  });
  row.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!decided) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      // Horizontal wins if it's clearly sideways
      if (Math.abs(mx) > Math.abs(my) * 1.3) {
        decided = true;
        direction = mx > 0 ? 1 : -1;
        row.style.transition = "none";
      } else {
        dragging = false; return; // vertical scroll — let the page handle it
      }
    }
    dx = Math.max(-160, Math.min(160, mx));
    row.style.transform = `translateX(${dx}px)`;
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    row.style.transition = "transform 0.18s ease";
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      // Commit the action.
      const outX = direction > 0 ? window.innerWidth : -window.innerWidth;
      row.style.transform = `translateX(${outX}px)`;
      vibrate(20);
      setTimeout(() => {
        if (direction > 0) swipeMarkDone(id);
        else swipeDelete(id);
        // render() will replace the row entirely, so we don't need to reset transform
      }, 150);
    } else {
      row.style.transform = "translateX(0)";
    }
    dx = 0;
  };
  row.addEventListener("pointerup", finish);
  row.addEventListener("pointercancel", finish);
  row.addEventListener("pointerleave", () => { if (dragging && decided) finish(); });
}

function swipeMarkDone(id) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  const prev = { status: r.status, startedAt: r.startedAt, endedAt: r.endedAt };
  if (r.status === "started") r.endedAt = Date.now();
  r.status = "done";
  saveState();
  render();
  showUndo(`Marked done: ${r.activity}`, () => { Object.assign(r, prev); saveState(); render(); });
}

function swipeDelete(id) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  const idx = state.reminders.indexOf(r);
  state.reminders.splice(idx, 1);
  saveState();
  render();
  showUndo(`Deleted "${r.activity}"`, () => {
    state.reminders.splice(idx, 0, r); sortReminders(); saveState(); render();
  });
}

/* ---------- Weekly view ---------- */

let weeklyTab = "plan";

function openWeekly() {
  weeklyTab = "plan";
  document.querySelectorAll("#weeklyTabs .seg").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === weeklyTab));
  renderWeekly();
  showModal("weeklyModal");
}

function renderWeekly() {
  const body = $("weeklyBody");
  body.innerHTML = "";
  if (weeklyTab === "plan") {
    // The next 7 days starting today.
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      body.appendChild(renderWeekDay(d, /*history*/ false));
    }
  } else {
    // The last 7 days ending yesterday.
    const h = historyLoad();
    for (let i = 7; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      body.appendChild(renderWeekDay(d, /*history*/ true, h));
    }
    body.appendChild(renderStreakList());
  }
}

function renderWeekDay(date, isHistory, h) {
  const box = document.createElement("div");
  box.className = "week-day";
  const dow = date.getDay();
  const isToday = todayStr(date) === todayStr();
  const label = `${DAY_SHORT[dow]} ${date.getDate()}/${date.getMonth() + 1}` + (isToday ? " · today" : "");

  const head = document.createElement("div");
  head.className = "week-day-head";
  head.innerHTML = `<span class="week-day-title${isToday ? " today" : ""}">${label}</span><span class="week-day-stat" id="stat-${date.getTime()}"></span>`;
  box.appendChild(head);

  let items;
  if (isHistory) {
    items = (h[todayStr(date)] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
  } else {
    items = state.reminders.filter((r) => appliesOn(r, dow));
  }
  if (!items.length) {
    const p = document.createElement("div");
    p.className = "week-empty";
    p.textContent = isHistory ? "No history recorded." : "Nothing scheduled.";
    box.appendChild(p);
    return box;
  }
  let done = 0, skipped = 0;
  items.forEach((r) => {
    const row = document.createElement("div");
    row.className = "week-item"
      + (isHistory && r.status === "done" ? " done" : "")
      + (isHistory && r.status === "skipped" ? " skipped" : "");
    row.style.setProperty("--rc", COLORS[r.color || "gray"] || COLORS.gray);
    const suffix = isHistory && r.startedAt
      ? ` · ${fmtTs(r.startedAt)}${r.endedAt ? "–" + fmtTs(r.endedAt) : ""}`
      : "";
    row.innerHTML = `<span class="week-time">${fmtStoredTime(r.time)}</span><span>${escapeHtml(r.activity)}${suffix}</span>`;
    box.appendChild(row);
    if (r.status === "done") done++;
    if (r.status === "skipped") skipped++;
  });
  const stat = head.querySelector(".week-day-stat");
  if (isHistory) stat.textContent = `${done}/${items.length}`;
  else stat.textContent = `${items.length} planned`;
  return box;
}

function renderStreakList() {
  const wrap = document.createElement("div");
  wrap.className = "streak-list";
  const heading = document.createElement("div");
  heading.className = "section-label";
  heading.textContent = "Active streaks";
  wrap.appendChild(heading);
  let any = false;
  state.reminders.forEach((r) => {
    const s = computeStreak(r.id);
    if (s < 2) return;
    any = true;
    const row = document.createElement("div");
    row.className = "streak-item";
    row.innerHTML = `<span>${escapeHtml(r.activity)}</span><b>🔥 ${s} days</b>`;
    wrap.appendChild(row);
  });
  if (!any) {
    const empty = document.createElement("div");
    empty.className = "week-empty";
    empty.textContent = "No streaks yet — history builds up as you use the app.";
    wrap.appendChild(empty);
  }
  return wrap;
}

/* ---------- Focus mode ---------- */

// Fullscreen distraction-free view of the currently running task. The now-card
// stays in sync (renderNow() calls updateFocus while the overlay is open) so
// we don't need a second interval.
function openFocus() {
  const r = runningTask();
  if (!r) { toast("No task running"); return; }
  updateFocus(r);
  $("focusOverlay").hidden = false;
}
function closeFocus() { $("focusOverlay").hidden = true; }
function updateFocus(r) {
  $("focusClock").textContent = fmtClock();
  $("focusActivity").textContent = r.activity;
  $("focusElapsed").textContent = `${elapsedMin(r.startedAt)} min`;
  const planned = parseDurationMin(r.duration);
  const end = endTimeStr(r);
  $("focusPlanned").textContent =
    (r.duration ? `planned ${r.duration}` : "") +
    (end ? ` · ends ${end}` : "") +
    (planned ? ` · ${Math.max(0, planned - elapsedMin(r.startedAt))} min left` : "");
  $("focusNotes").textContent = r.notes || "";
}

/* ---------- Service worker: incoming notification-action messages ---------- */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const msg = event.data || {};
    if (msg.type !== "notificationAction") return;
    const r = state.reminders.find((x) => x.id === msg.id);
    if (!r) return;
    if (msg.action === "start") startTask(r.id);
    else if (msg.action === "skip") skipReminder(r.id);
    else if (msg.action && msg.action.startsWith("snooze-")) {
      const mins = parseInt(msg.action.split("-")[1], 10) || 5;
      snoozeReminder(r.id, mins);
    }
  });
}

/* ---------- Modal + toast helpers ---------- */

function showModal(id) { $(id).hidden = false; }
function hideModal(id) { $(id).hidden = true; }

let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  $("toastMsg").textContent = msg;
  $("toastUndo").hidden = true;
  pendingUndo = null;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2000);
}

/* ---------- Wiring ---------- */

function wireEvents() {
  $("addBtn").addEventListener("click", openAdd);
  $("templatesBtn").addEventListener("click", () => { renderTemplateList(); showModal("templateModal"); });
  $("resetChecksBtn").addEventListener("click", () => {
    state.reminders.forEach((r) => { r.status = "upcoming"; r.startedAt = null; r.endedAt = null; });
    saveState(); render(); toast("Checklist reset");
  });

  $("menuBtn").addEventListener("click", openSettings);
  $("settingsBtn").addEventListener("click", openSettings);

  $("editForm").addEventListener("submit", submitEdit);
  $("cancelEditBtn").addEventListener("click", () => hideModal("editModal"));
  $("deleteReminderBtn").addEventListener("click", deleteReminder);

  $("closeTemplateBtn").addEventListener("click", () => hideModal("templateModal"));
  $("closeSettingsBtn").addEventListener("click", () => hideModal("settingsModal"));

  // Theme segmented control
  document.querySelectorAll("#themeSegmented .seg").forEach((b) => {
    b.addEventListener("click", () => {
      state.prefs.theme = b.dataset.theme;
      applyTheme(); saveState();
    });
  });

  $("setNotify").addEventListener("change", (e) => setNotifications(e.target.checked));
  $("setSound").addEventListener("change", (e) => { state.prefs.soundEnabled = e.target.checked; saveState(); });

  // Do Not Disturb window
  $("setDndStart").addEventListener("change", (e) => { state.prefs.dndStart = e.target.value || null; saveState(); });
  $("setDndEnd").addEventListener("change", (e) => { state.prefs.dndEnd = e.target.value || null; saveState(); });
  $("setDndClear").addEventListener("click", () => {
    state.prefs.dndStart = null; state.prefs.dndEnd = null;
    $("setDndStart").value = ""; $("setDndEnd").value = ""; saveState(); toast("DND off");
  });

  // Days-of-week picker toggles
  document.querySelectorAll("#fldDays button").forEach((b) => {
    b.addEventListener("click", () => b.classList.toggle("on"));
  });

  // Weekly view
  $("weeklyBtn").addEventListener("click", openWeekly);
  $("closeWeeklyBtn").addEventListener("click", () => hideModal("weeklyModal"));
  document.querySelectorAll("#weeklyTabs .seg").forEach((b) => {
    b.addEventListener("click", () => {
      weeklyTab = b.dataset.tab;
      document.querySelectorAll("#weeklyTabs .seg").forEach((x) =>
        x.classList.toggle("active", x === b));
      renderWeekly();
    });
  });

  // Undo button in the toast
  $("toastUndo").addEventListener("click", doUndo);

  $("exportBtn").addEventListener("click", exportSchedule);
  $("backupBtn").addEventListener("click", backupAll);
  $("saveTemplateBtn").addEventListener("click", saveScheduleAsTemplate);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importSchedule(e.target.files[0]); e.target.value = ""; });
  $("shareBtn").addEventListener("click", shareLink);
  $("wipeBtn").addEventListener("click", wipeAll);

  // Time format segmented control
  document.querySelectorAll("#timeFmtSegmented .seg").forEach((b) => {
    b.addEventListener("click", () => {
      state.prefs.timeFormat = b.dataset.fmt;
      applyTimeFormat(); saveState();
      // Re-render everywhere the time appears
      lastTimelineSig = null; render();
    });
  });

  // Focus mode
  $("nowFocusBtn").addEventListener("click", openFocus);
  $("focusCloseBtn").addEventListener("click", closeFocus);
  $("focusEndBtn").addEventListener("click", () => {
    const r = runningTask();
    closeFocus();
    if (r) endTask(r.id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("focusOverlay").hidden) closeFocus();
  });

  // Task-flow controls
  $("selectModeBtn").addEventListener("click", () => (selectMode ? exitSelectMode() : enterSelectMode()));
  $("selDoneBtn").addEventListener("click", () => bulkMark("done"));
  $("selSkipBtn").addEventListener("click", () => bulkMark("skipped"));
  $("selCancelBtn").addEventListener("click", exitSelectMode);
  $("catchupCancelBtn").addEventListener("click", () => { pendingStartId = null; hideModal("catchupModal"); });
  $("catchupConfirmBtn").addEventListener("click", confirmCatchUp);
  $("nextStartBtn").addEventListener("click", () => {
    hideModal("nextSheet");
    if (pendingNextId != null) startTask(pendingNextId);
    pendingNextId = null;
  });
  $("nextLaterBtn").addEventListener("click", () => { pendingNextId = null; hideModal("nextSheet"); });
  $("summaryCloseBtn").addEventListener("click", () => hideModal("summaryModal"));
  $("nowEndBtn").addEventListener("click", () => { const r = runningTask(); if (r) endTask(r.id); });

  // Tap the dark backdrop to dismiss a modal
  document.querySelectorAll(".modal-backdrop").forEach((bd) => {
    bd.addEventListener("click", (e) => { if (e.target === bd) bd.hidden = true; });
  });

  // Re-check the moment the app returns to the foreground
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}

function init() {
  populateColorSelect();
  loadState();
  wireEvents();
  applyTheme();

  importFromUrlIfPresent();
  maybeMidnightReset();

  // First run with an empty schedule → offer templates
  if (state.reminders.length === 0) {
    renderTemplateList();
    showModal("templateModal");
  }

  render();
  checkDueReminders();

  // Tick every 15s: updates the clock/progress and fires due reminders.
  setInterval(tick, 15000);

  // Register the service worker for offline use (ignored if unsupported)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
