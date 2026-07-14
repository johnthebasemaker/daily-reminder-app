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
    name: "9-to-5 Office Worker",
    desc: "Commute, focused work blocks, family time.",
    reminders: [
      { time: "06:00", activity: "Morning Routine & Prayer", duration: "45 min", color: "purple" },
      { time: "06:45", activity: "Commute to Office", duration: "30 min", color: "cyan" },
      { time: "09:00", activity: "Work Block 1", duration: "3 hours", color: "blue" },
      { time: "12:00", activity: "Lunch Break", duration: "1 hour", color: "green" },
      { time: "13:00", activity: "Work Block 2", duration: "3 hours", color: "blue" },
      { time: "16:00", activity: "Coffee Break + Walk", duration: "30 min", color: "yellow" },
      { time: "16:30", activity: "Work Block 3", duration: "1.5 hours", color: "blue" },
      { time: "17:45", activity: "Commute Home", duration: "30 min", color: "cyan" },
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
};

/* ---------- 2. State + persistence ---------- */

let state = {
  reminders: [],          // array of reminder objects
  templateName: "",       // name of currently-loaded template
  prefs: { theme: "auto", notificationEnabled: false, soundEnabled: true },
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
function fmtClock(d = new Date()) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
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

// Given the sorted list, find which reminder is "current" (most recent past one)
// and the list of upcoming ones for today.
function computeCurrentAndNext() {
  const now = nowMinutes();
  let current = null;
  const upcoming = [];
  for (const r of state.reminders) {
    const t = toMinutes(r.time);
    if (t <= now) current = r;      // last one that has already started
    else upcoming.push(r);          // still to come today
  }
  return { current, upcoming };
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

  if (!current) {
    $("nowActivity").textContent = upcoming.length ? "Nothing yet — first up soon" : "No activity right now";
    $("nowMeta").textContent = upcoming.length ? `${upcoming[0].activity} at ${upcoming[0].time}` : "";
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
      <span class="nextup-time">${r.time}</span>
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
  const sig = JSON.stringify({
    c: current ? current.id : 0,
    r: state.reminders.map((r) => [r.id, r.time, r.activity, r.duration, r.color, r.completed, r.notificationEnabled, r.soundEnabled]),
  });
  if (sig === lastTimelineSig) return; // nothing changed → leave the DOM alone
  lastTimelineSig = sig;

  const list = $("timelineList");
  list.innerHTML = "";
  $("emptyHint").hidden = state.reminders.length > 0;

  state.reminders.forEach((r) => {
    const li = document.createElement("li");
    li.className = "reminder" + (r.completed ? " done" : "") + (current && current.id === r.id ? " current" : "");
    li.style.setProperty("--rc", COLORS[r.color] || COLORS.gray);

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "reminder-check";
    check.checked = !!r.completed;
    check.setAttribute("aria-label", "Mark complete");
    check.addEventListener("change", () => toggleComplete(r.id, check.checked));

    const body = document.createElement("div");
    body.className = "reminder-body";
    const isCurrent = current && current.id === r.id;
    body.innerHTML = `
      <div class="reminder-time">${r.time}${isCurrent ? '<span class="current-tag">now</span>' : ""}</div>
      <div class="reminder-name">${escapeHtml(r.activity)}</div>
      ${r.duration ? `<div class="reminder-dur">${escapeHtml(r.duration)}</div>` : ""}`;
    body.addEventListener("click", () => openEdit(r.id));

    const badges = document.createElement("div");
    badges.className = "reminder-badges";
    badges.innerHTML =
      (r.notificationEnabled ? "🔔" : "🔕") + (r.notificationEnabled && r.soundEnabled ? "🔊" : "");

    li.append(check, body, badges);
    list.appendChild(li);
  });
}

function renderCompletion() {
  const total = state.reminders.length;
  const done = state.reminders.filter((r) => r.completed).length;
  $("completionPct").textContent = total ? `${done}/${total} done` : "0/0 done";
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

function openEdit(id) {
  editingId = id;
  const r = state.reminders.find((x) => x.id === id);
  $("editTitle").textContent = "Edit reminder";
  $("fldTime").value = r.time;
  $("fldActivity").value = r.activity;
  $("fldDuration").value = r.duration || "";
  $("fldColor").value = COLORS[r.color] ? r.color : "gray";
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
  $("fldNotify").checked = true;
  $("fldSound").checked = true;
  $("deleteReminderBtn").hidden = true;
  showModal("editModal");
  setTimeout(() => $("fldActivity").focus(), 100);
}

function submitEdit(e) {
  e.preventDefault();
  const data = {
    time: $("fldTime").value,
    activity: $("fldActivity").value.trim(),
    duration: $("fldDuration").value.trim(),
    color: $("fldColor").value,
    notificationEnabled: $("fldNotify").checked,
    soundEnabled: $("fldSound").checked,
  };
  if (!data.time || !data.activity) return;

  if (editingId == null) {
    state.reminders.push(Object.assign({ id: genId(), completed: false }, data));
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
  state.reminders = state.reminders.filter((x) => x.id !== editingId);
  saveState();
  render();
  hideModal("editModal");
  toast("Deleted");
}

function toggleComplete(id, val) {
  const r = state.reminders.find((x) => x.id === id);
  if (r) { r.completed = val; saveState(); render(); }
}

/* ---------- 6. Templates ---------- */

function renderTemplateList() {
  const wrap = $("templateList");
  wrap.innerHTML = "";
  TEMPLATES.forEach((tmpl, i) => {
    const card = document.createElement("div");
    card.className = "template-card";
    card.innerHTML = `
      <h3>${escapeHtml(tmpl.name)}</h3>
      <p>${escapeHtml(tmpl.desc)} · ${tmpl.reminders.length} reminders</p>
      <div class="tc-actions">
        <button class="action-btn primary" data-act="replace" data-i="${i}">Load &amp; Replace</button>
        <button class="action-btn" data-act="merge" data-i="${i}">Merge</button>
      </div>`;
    wrap.appendChild(card);
  });
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => applyTemplate(+btn.dataset.i, btn.dataset.act));
  });
}

function makeReminderFromTemplate(t) {
  return {
    id: genId(),
    time: t.time,
    activity: t.activity,
    duration: t.duration || "",
    color: COLORS[t.color] ? t.color : "gray",
    notificationEnabled: true,
    soundEnabled: true,
    completed: false,
  };
}

function applyTemplate(index, mode) {
  const tmpl = TEMPLATES[index];
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
  applyTheme();
  showModal("settingsModal");
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

function exportSchedule() {
  const payload = { name: state.templateName || "My Schedule", reminders: state.reminders };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "daily-schedule.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Exported JSON");
}

function importSchedule(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const arr = Array.isArray(data) ? data : data.reminders;
      if (!Array.isArray(arr)) throw new Error("bad");
      state.reminders = arr.map((t) => makeReminderFromTemplate(t));
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

function fireReminder(r) {
  // On-screen flash
  const card = $("nowCard");
  card.classList.remove("flash");
  void card.offsetWidth; // restart animation
  card.classList.add("flash");

  // Skip noisy notifications for very long / sleep activities (smart notifications)
  const isSleep = /sleep/i.test(r.activity);

  if (state.prefs.notificationEnabled && "Notification" in window && Notification.permission === "granted" && !isSleep) {
    try {
      new Notification(r.activity, {
        body: `${r.time}${r.duration ? " · " + r.duration : ""}`,
        tag: "reminder-" + r.id,
        icon: "icons/icon-192.png",
      });
    } catch (e) { /* ignore */ }
  }
  if (state.prefs.soundEnabled && r.soundEnabled && !isSleep) beep();
}

function checkDueReminders() {
  const now = nowMinutes();
  state.reminders.forEach((r) => {
    if (!r.notificationEnabled) return;
    const t = toMinutes(r.time);
    const key = r.id + "@" + r.time;
    // Fire within a 1-minute window of the scheduled time, once per day.
    if (now === t && !firedToday.has(key)) {
      firedToday.add(key);
      fireReminder(r);
    }
  });
}

/* ---------- 9. Midnight reset + tick loop ---------- */

function maybeMidnightReset() {
  const today = todayStr();
  const last = localStorage.getItem(LS.lastReset);
  if (last !== today) {
    // New day: clear all completed flags and the "already fired" tracker.
    state.reminders.forEach((r) => { r.completed = false; });
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

/* ---------- Modal + toast helpers ---------- */

function showModal(id) { $(id).hidden = false; }
function hideModal(id) { $(id).hidden = true; }

let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2000);
}

/* ---------- Wiring ---------- */

function wireEvents() {
  $("addBtn").addEventListener("click", openAdd);
  $("templatesBtn").addEventListener("click", () => { renderTemplateList(); showModal("templateModal"); });
  $("resetChecksBtn").addEventListener("click", () => {
    state.reminders.forEach((r) => (r.completed = false));
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

  $("exportBtn").addEventListener("click", exportSchedule);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importSchedule(e.target.files[0]); e.target.value = ""; });
  $("shareBtn").addEventListener("click", shareLink);
  $("wipeBtn").addEventListener("click", wipeAll);

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
