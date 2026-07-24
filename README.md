# Daily Reminder & Alarm

A fully customizable daily reminder/alarm web app, optimized for iPhone. Installable as a
home-screen app (PWA), works **completely offline**, and keeps **all data on your device** —
no accounts, no server, nothing uploaded.

Built as a plain **static site** (HTML + CSS + vanilla JS). No build step, no `npm`,
no framework. Just open `index.html`.

---

## Features

> ⚠️ **Before every deploy:** bump `CACHE_VERSION` in `service-worker.js`
> (currently `daily-reminder-v4`) whenever any file changes, or returning
> users will keep seeing the old cached version.

- **Focus mode** — tap **Focus** while a task is running to enter a full-screen
  distraction-free view with a huge activity name, live elapsed timer, planned
  end-time, and your notes. Tap End (or Esc) to return.
- **Full backup + restore** — Settings → *Backup all* downloads a single JSON
  file with your schedule + 90-day history + preferences + custom templates.
  *Import / restore* recognizes it and puts everything back.
- **Save custom templates** — Settings → *Save as template* stores the current
  schedule (name it whatever) and it shows up alongside KSA/Student/Office in
  the Templates modal, with a ✕ to delete.
- **12/24-hour clock** — Settings → *Time format* toggle (defaults to Auto,
  which matches your browser locale).

- **3 preset templates** — KSA 12-Hour Shift, Student, 9-to-5 Office (load & replace, or merge).
- **Task flow (Start / End)** — tap **Start** when you begin a task and **End** when you finish;
  the app records the **actual** start/end times and shows them next to the planned slot
  (e.g. `actual 21:11–21:38 · 27 min`). Only one task runs at a time.
- **Start-next prompt** — ending a task offers to start the next one with a single tap.
- **Catch-up sheet** — if you start a later task while earlier ones were never marked, the app
  asks which of them you actually did; the rest are marked **skipped** (distinct from done).
- **Multi-select** — long-press a task (or tap *Select*) to bulk-mark several as done or skipped.
- **End-of-day summary** — after the last task: completed count, skipped count, total tracked time.
- **Now card** — current time, current/running activity, minutes elapsed / remaining, live progress bar.
- **Next up** — the next 3 reminders with countdowns.
- **Color-coded timeline** — all activities for the day; the current one is highlighted with a `NOW` badge.
- **Checklist** — tick off activities; honest completion counter (`7✓ · 2⤼ · 2 left`); auto-resets at midnight.
- **Add / edit / delete** reminders (time, activity, duration, color, notify, sound). Auto-sorted by time.
- **Notifications + sound** — browser push notifications at the scheduled minute, plus a built-in chime
  (generated with the Web Audio API, so it works offline). Sleep activities are skipped automatically.
- **Dark / Light / Auto** theme (Auto follows your device).
- **Export / Import** schedule as JSON, or **Share as a link** (schedule encoded in the URL — nothing
  is sent to any server).
- **Offline PWA** — a service worker caches everything; installable to the home screen.

Your data lives in `localStorage` under these keys: `dailyReminders`, `selectedTemplate`,
`userPreferences`, `lastResetDate`.

---

## Run it locally

Because it's a static site, any static server works:

```bash
cd daily-reminder-app
python3 -m http.server 8000
# then open http://localhost:8000
```

> Open it over `http://` (a server), **not** by double-clicking the file (`file://`),
> because service workers and notifications require a server origin.

---

## Deploy to GitHub Pages (auto-updates on every push)

You have **two options**. Option A is the simplest and needs no extra files.

### Option A — Deploy from the `main` branch (recommended, zero config)

1. Create a new **public** repo on GitHub (e.g. `daily-reminder-app`).
2. Push this folder:
   ```bash
   cd daily-reminder-app
   git init
   git add .
   git commit -m "Daily Reminder App"
   git branch -M main
   git remote add origin https://github.com/johnthebasemaker/daily-reminder-app.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment**
   - **Source:** *Deploy from a branch*
   - **Branch:** `main` — **Folder:** `/ (root)` → **Save**
4. Wait ~1 minute. Your app is live at:
   ```
   https://johnthebasemaker.github.io/daily-reminder-app/
   ```

Every future `git push` to `main` updates the live site automatically.

### Option B — GitHub Actions (already included)

This repo ships `.github/workflows/deploy.yml`, which deploys on every push using the
official GitHub Pages actions (no `gh-pages` branch, no `npm`).

1. Push the repo (steps 1–2 above).
2. On GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Done — every push runs the workflow and publishes the site.

---

## Updating the app later

```bash
git add .
git commit -m "Update: describe what changed"
git push        # site redeploys automatically (Option A or B)
```

If you change any file, bump `CACHE_VERSION` in `service-worker.js`
(e.g. `daily-reminder-v1` → `v2`) so returning users get the new version instead of the cached one.

---

## Install on a phone

- **iPhone (Safari):** open the URL → Share → **Add to Home Screen**.
- **Android (Chrome):** open the URL → menu (⋮) → **Install app**.

Notifications require granting permission (Settings → *Enable notifications* inside the app).
On iOS, notifications work best when the app has been **added to the Home Screen** and opened from there.

---

## File overview

| File | Purpose |
|------|---------|
| `index.html` | Markup and modals |
| `styles.css` | All styling, light/dark themes, iPhone safe-area handling |
| `app.js` | All logic — state, templates, rendering, notifications, storage |
| `manifest.webmanifest` | PWA metadata (name, icons, colors) |
| `service-worker.js` | Offline caching |
| `icons/` | App icons (SVG source + generated PNGs) |
| `.github/workflows/deploy.yml` | Optional auto-deploy via GitHub Actions |

---

## Customizing

- **Templates:** edit the `TEMPLATES` array near the top of `app.js`.
- **Colors:** edit the `COLORS` map in `app.js` (name → hex) and the theme variables in `styles.css`.
- **Notification timing / smart-skip rules:** see `checkDueReminders()` and `fireReminder()` in `app.js`.
