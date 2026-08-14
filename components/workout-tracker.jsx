"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Theme-dependent tokens are CSS custom properties so light/dark mode can be
// swapped live without threading theme state through every component.
// Brand/category colors (push/pull/legs/sprint/warn/ok) stay constant across
// themes — they're mid-saturation hues that read fine on both light and dark.
const C = {
  bg:"var(--bg)", surface:"var(--surface)", surfaceHi:"var(--surfaceHi)", card:"var(--card)",
  border:"var(--border)", borderHi:"var(--borderHi)",
  gold:"var(--gold)", goldDim:"var(--goldDim)",
  push:"#ff1744", pull:"#2979ff", legs:"#00e676", sprint:"#00e5ff",
  warn:"#ff1744", ok:"#00e676",
  text:"var(--text)", textMid:"var(--textMid)", textLow:"var(--textLow)",
};
const SP = { xs:4, sm:8, md:16, lg:24, xl:32 };

const THEME_VARS = {
  dark: {
    "--bg":"#000000", "--surface":"#0d0d0d", "--surfaceHi":"#1a1a1a", "--card":"#141414",
    "--border":"#2a2a2a", "--borderHi":"#3d3d3d",
    "--text":"#ffffff", "--textMid":"#aaaaaa", "--textLow":"#555555",
    "--gold":"#ffffff", "--goldDim":"#888888",
    "--gold-06":"#ffffff0f", "--gold-22":"#ffffff22", "--gold-45":"#ffffff45", "--gold-88":"#ffffff88",
    "--bg-dd":"#000000dd",
  },
  light: {
    "--bg":"#f5f5f5", "--surface":"#ffffff", "--surfaceHi":"#efefef", "--card":"#ffffff",
    "--border":"#dddddd", "--borderHi":"#cccccc",
    "--text":"#111111", "--textMid":"#555555", "--textLow":"#999999",
    "--gold":"#111111", "--goldDim":"#888888",
    "--gold-06":"#11111106", "--gold-22":"#11111122", "--gold-45":"#11111145", "--gold-88":"#11111188",
    "--bg-dd":"#f5f5f5dd",
  },
};
const THEME_STORAGE_KEY = "jayanth_theme_mode";

// Single source of truth for the app icon image — reused by the header logo
// and the splash screen so the exact same artwork is never duplicated.
const ICON_DATA_URI = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-black-bg-nLOXDLOy2CJHF6kJb6ak4zkyOS6qc5.png";

const SESSIONS = [
  { id:"push",   label:"Push Day",   sub:"Chest · Shoulders · Triceps",              icon:"🟥", color:C.push,   loc:"Transform 365", note:"5 exercises, same every week — 2 reps in reserve on every set." },
  { id:"pull",   label:"Pull Day",   sub:"Back · Biceps · Core",                     icon:"🟦", color:C.pull,   loc:"Transform 365", note:"6 exercises, same every week — straps allowed on exercises 1–3." },
  { id:"legs",   label:"Leg Day",    sub:"Hips · Quads · Hamstrings · Calves · Core", icon:"🟩", color:C.legs,   loc:"Transform 365", note:"6 exercises, same every week — longest warmup of the week." },
  { id:"sprint", label:"Sprint Day", sub:"3× per month · replaces that week's Legs", icon:"💨", color:C.sprint, loc:"MPT Ground",    note:"Full 2–3 min rest between every sprint — non-negotiable. Stop the session if speed visibly drops. Skip that week's Legs entirely." },
];

// Mobility no longer has one fixed accent color — every component that
// renders it (StartPicker, MobilityView, Heatmap) computes a theme-aware
// literal locally (white on dark / black on light) via the themeMode prop,
// since white alone is invisible against the light theme's background.
const MOBILITY = [
  { id:"after_push_before_sprint", after:"Push", before:"Sprint Focus",
    focus:"Shoulder recovery from push day, light lower-body activation for sprint",
    items:[
      "Cross-body shoulder stretch — 30s each arm",
      "Doorway chest stretch — 30s",
      "Cat-cow (spine mobility) — 8-10 reps",
      "Leg swings (front-back, side-side) — 10 each leg",
      "Walking lunges, bodyweight only — 8 each leg",
      "Light 5-minute walk or easy jog",
    ]},
  { id:"after_sprint_before_pull", after:"Sprint", before:"Pull Focus",
    focus:"Lower-leg recovery from sprint, light upper-body prep for pull",
    items:[
      "Standing calf stretch — 30s each leg",
      "Hamstring stretch (seated or standing) — 30s each leg",
      "Foam roll quads and calves — 1-2 min each",
      "Band pull-aparts — 15-20 reps, light",
      "Cat-cow — 8-10 reps",
    ]},
  { id:"after_pull_before_leg", after:"Pull", before:"Leg (your highest-priority mobility day)",
    focus:"Knee, ankle, and hip prep — this is the rest day that matters most given your knee situation",
    items:[
      "Ankle dorsiflexion stretch (knee-to-wall) — 10 reps each ankle, hold 2-3s",
      "Hip flexor stretch (half-kneeling) — 30s each side",
      "Foam roll quads and IT band — 1-2 min each",
      "Glute bridges, bodyweight — 12-15 reps",
      "Terminal knee extension, light band — 10-12 reps each leg",
      "Bodyweight squats, partial range, slow and controlled — 10 reps, used as a check-in for how the knee feels before tomorrow's loaded session",
    ]},
  { id:"after_push_before_pull", after:"Push", before:"Pull",
    focus:"Shoulder recovery from push day, no lower-body demand coming next, so this can stay light and upper-body focused",
    items:[
      "Cross-body shoulder stretch — 30s each arm",
      "Doorway chest stretch — 30s",
      "Cat-cow (spine mobility) — 8-10 reps",
      "Band pull-aparts — 15-20 reps, light, primes the back/shoulders for pull day",
      "Child's pose with reach — 30s, gentle lat stretch",
    ]},
  { id:"after_leg_before_sprint", after:"Leg", before:"Sprint",
    focus:"This is now your most critical mobility day — knee recovery from leg day directly feeding into sprint's deceleration demands, with only one rest day between two knee-intensive sessions",
    items:[
      "Foam roll quads, IT band, and calves — 1-2 min each, prioritize recovery from leg day's loading",
      "Ankle dorsiflexion stretch (knee-to-wall) — 10 reps each ankle, hold 2-3s",
      "Hip flexor stretch (half-kneeling) — 30s each side",
      "Glute bridges, bodyweight — 12-15 reps",
      "Light leg swings (front-back, side-side) — 10 each leg, check how the knee feels moving",
      "Bodyweight squats, partial range, slow — 10 reps, used specifically as a readiness check before tomorrow's sprint",
    ]},
];

const EXERCISES = {
  push:[
    { id:"incline_db_press",  name:"30° Incline DB Press",     icon:"📐",weighted:true,  sets:3,   reps:"8–12",   tempo:"3-1-1-0", focus:"Low incline only · lower 3s, 1s stretch, press" },
    { id:"machine_chest_press",name:"Machine Chest Press",     icon:"🏋",weighted:true,  sets:3,   reps:"10–12",  tempo:"3-0-1-1", focus:"Back flat against pad · drive elbows together at top" },
    { id:"lateral_raises",    name:"Lateral Raises",            icon:"↔",weighted:true,  sets:2,   reps:"15–20",  tempo:"2-0-1-1", focus:"Slight forward lean · raise into your line of sight" },
    { id:"cable_face_pulls",  name:"Cable Face Pulls",          icon:"🎯",weighted:true,  sets:2,   reps:"15–20",  tempo:"2-0-1-2", focus:"Rope to nose, 2s squeeze · rotator cuff insurance — every push session" },
    { id:"tricep_pushdown",   name:"Tricep Pushdown (Rope)",    icon:"⬇",weighted:true,  sets:2,   reps:"12–15",  tempo:"2-0-1-2", focus:"Elbows locked to ribs · flare rope at lockout" },
  ],
  pull:[
    { id:"pullups",           name:"Neutral-Grip Pull-Ups",     icon:"🤸",weighted:false, sets:"3–4", reps:"max",    tempo:"3-1-1-1", focus:"Shrug down before pulling · dead hang at bottom · use straps" },
    { id:"tbar_row",          name:"Chest-Supported T-Bar Row", icon:"🏋",weighted:true,  sets:3,   reps:"8–10",   tempo:"2-0-1-2", focus:"Chest glued to pad — removes lower back from the lift entirely · use straps" },
    { id:"lat_pulldown_single",name:"Single-Arm Lat Pulldown",  icon:"⬇",weighted:true,  sets:2,   reps:"12–15",  tempo:"2-1-1-0", focus:"Pull elbow to back pocket · use straps" },
    { id:"incline_curl",      name:"Incline DB Bicep Curl",     icon:"💪",weighted:true,  sets:2,   reps:"10–12",  tempo:"3-0-1-0", focus:"Elbows pinned · full stretch at bottom" },
    { id:"hammer_curl",       name:"Cross-Body Hammer Curl",    icon:"🔨",weighted:true,  sets:2,   reps:"12–15",  tempo:"3-0-1-1", focus:"Neutral grip · curl across body" },
    { id:"pallof_press",      name:"Cable Pallof Press",        icon:"🛡",weighted:true,  sets:2,   reps:"12–15 ea",tempo:"2-1-2-0",focus:"Anti-rotation core finisher · resist the cable pulling you sideways" },
  ],
  legs:[
    { id:"hip_thrust",        name:"Barbell Hip Thrust",        icon:"🍑",weighted:true,  sets:3,   reps:"8–10",   tempo:"2-0-1-2", focus:"Full hip extension at top, 2s hold, chin tucked · always first while fresh" },
    { id:"leg_press",         name:"Leg Press",                 icon:"🦵",weighted:true,  sets:3,   reps:"10–12",  tempo:"3-1-1-0", focus:"Feet mid-height, toes out 15° · stop before lower back lifts off seat" },
    { id:"leg_extension",     name:"Seated Leg Extension",      icon:"🦵",weighted:true,  sets:2,   reps:"12–15",  tempo:"3-0-1-2", focus:"Light-moderate weight only · 2s peak squeeze" },
    { id:"seated_leg_curl",   name:"Seated Leg Curl",           icon:"🦿",weighted:true,  sets:2,   reps:"12–15",  tempo:"3-0-1-2", focus:"Control the eccentric fully · squeeze hamstring at peak contraction" },
    { id:"seated_calf",       name:"Seated Calf Raise",         icon:"🪑",weighted:true,  sets:2,   reps:"15–20",  tempo:"2-1-1-1", focus:"Full stretch at bottom, 1s pause, then drive up" },
    { id:"rkc_plank",         name:"RKC Plank",                 icon:"🧘",weighted:false, sets:2,   reps:"20–30s", tempo:"max tension", focus:"Drive elbows and toes toward each other · glutes locked · core finisher" },
    { id:"back_extension",    name:"Back Extension",            icon:"🔼",weighted:false, sets:2,   reps:"12–15",  tempo:"2-0-1-1", focus:"Neutral spine throughout · squeeze glutes at top · posterior chain support" },
  ],
  sprint:[
    { id:"sprint_main",       name:"40–50m Sprints",            icon:"💨",weighted:false, sets:"5–6", reps:"@ 100%", rest:"2–3 min", focus:"Full rest between every sprint — non-negotiable, the energy system needs the full window to reload. Stop the session entirely if speed visibly drops on any rep." },
  ],
};

const WARMUPS = {
  push:[
    { name:"Warm-Up", time:"3 min", items:[
      "Doorway thoracic extension × 3×15s — opens the upper back before any pressing",
      "Wall scapular push-ups × 1×10 — shoulder blade control before load",
      "Controlled arm screws × 1×10 — rotator cuff prep, arms out in a T, rotate slowly forward and back",
      "2 feeder sets on Incline DB Press × 2×6 @ 50% — never go straight into heavy sets cold",
    ]},
  ],
  pull:[
    { name:"Warm-Up", time:"3 min", items:[
      "Standing scapular overheads × 1×15 — shrug blades up, drive down into back pockets",
      "Lat awakeners × 1×12 each side — push against cable frame, feel the lat engage",
      "Controlled arm screws × 1×10 — same rotator prep as push day",
      "2 feeder sets on Pull-Ups × 2×4–5 easy — dead hang between reps",
    ]},
  ],
  legs:[
    { name:"Warm-Up", time:"5 min", items:[
      "Standing leg swings × 1×15 each leg — hip flexor + hamstring dynamic prep",
      "Glute squeezes × 1×12, 3s hold — wake the glutes before loading them",
      "Ankle circles × 1×10 each direction/foot — joint lubrication before any squat-pattern load",
      "Hip 90/90 × 45s each side — opens hip rotation before hip thrust and trap bar",
      "Hip thrust feeder sets × 2×8 light — rehearse the movement before full load",
    ]},
  ],
  sprint:[
    { name:"Warm-Up", time:"15 min", items:[
      "5 min easy jog",
      "Leg swings",
      "High knees",
      "Butt kicks",
      "A-skips",
      "3 progressive runs at 50% / 70% / 85% over 60m",
    ]},
  ],
};

const COOLDOWNS = {
  push:  [
    "Doorway chest stretch — 2×30s — reverses anterior shoulder position",
    "Passive bar hang — 1×60–90s — spinal decompression",
    "Box breathing — 2 min — 4s in, 4s hold, 4s out, 4s hold. Downshift before shower",
  ],
  pull:  [
    "Passive bar hang — 1×60–90s — mandatory after pulling volume",
    "Doorway lat stretch — 2×30s — releases lat tightness",
    "Box breathing — 2 min — same protocol",
  ],
  legs:  [
    "Standing quad stretch — 2×30s each leg — releases quad tension pulling on the knee",
    "Seated hamstring fold — 1×60s each leg — posterior chain release after trap bar work",
    "Pigeon pose — 90s each side — hip decompression, the most loaded zone today",
    "Box breathing — 2 min — biggest session of the week, most important close",
  ],
  sprint:[
    "5 min easy jog",
    "Standing hamstring fold — 60s",
    "Hip flexor stretch",
    "Calf stretch",
    "5 min box breathing flat on the ground",
  ],
};

const makeKey  = (d,s,e) => `${d}__${s}__${e}`;
const doneKey  = (d,s)   => `done__${d}__${s}`;
const doneMobilityKey = (d,p) => `doneMobility__${d}__${p}`;
const todayStr = ()      => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmtDate  = s       => { if(!s)return""; const [y,m,d]=s.split("-"); const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${parseInt(d,10)} ${mn[parseInt(m,10)-1]} ${y}`; };
const getWeekLabel  = ds => { const d=new Date(ds); const j=new Date(d.getFullYear(),0,4); return `W${String(Math.ceil(((d-j)/86400000+j.getDay()+1)/7)).padStart(2,"0")}`; };
const getMonthLabel = ds => { const [y,m]=ds.split("-"); const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${mn[parseInt(m,10)-1]} ${y.slice(2)}`; };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s) { return typeof s === "string" && DATE_RE.test(s); }

function daysSince(dateStr) {
  if (!isValidDate(dateStr)) return null;
  // Parse as UTC midnight so timezone can never shift the day boundary
  const d     = new Date(dateStr + "T00:00:00Z");
  const today = new Date(todayStr() + "T00:00:00Z");
  return Math.max(0, Math.floor((today - d) / 86400000));
}

// Parse an exercise log key safely. Returns { date, sessId, exId } or null.
// Key format: date__sessId__exId  (only the first two __ are separators;
// exId itself may contain single underscores but not double underscores).
function parseExKey(k) {
  const firstSep  = k.indexOf("__");
  if (firstSep < 0) return null;
  const secondSep = k.indexOf("__", firstSep + 2);
  if (secondSep < 0) return null;
  const date  = k.slice(0, firstSep);
  const sessId = k.slice(firstSep + 2, secondSep);
  const exId  = k.slice(secondSep + 2);
  if (!isValidDate(date) || !date || !sessId || !exId) return null;
  return { date, sessId, exId };
}

// Dates with ANY meaningful activity for a session:
//   • a done__ marker (session explicitly completed), OR
//   • at least one exercise with a real logged value (number or true)
// A valid date must match YYYY-MM-DD to guard against malformed keys.
function getSessionDates(log, sessId) {
  const dates = new Set();
  Object.keys(log ?? {}).forEach(k => {
    if (k.startsWith("done__")) {
      // format: done__YYYY-MM-DD__sessId
      const rest = k.slice(6); // strip "done__"
      const sep  = rest.lastIndexOf("__");
      if (sep < 0) return;
      const date = rest.slice(0, sep);
      const sid  = rest.slice(sep + 2);
      if (sid === sessId && isValidDate(date)) dates.add(date);
    } else {
      const parsed = parseExKey(k);
      if (!parsed || parsed.sessId !== sessId) return;
      const v = log[k];
      if (v !== null && v !== undefined) dates.add(parsed.date);
    }
  });
  return dates;
}

function getLastTrainedDate(log, sessId) {
  const dates = [...getSessionDates(log, sessId)].filter(isValidDate).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

// date -> array of sessIds trained that day, across all sessions
function getAllTrainingDates(log) {
  const map = {};
  Object.keys(EXERCISES).forEach(sid => {
    getSessionDates(log, sid).forEach(d => {
      if (!isValidDate(d)) return;
      if (!map[d]) map[d] = [];
      if (!map[d].includes(sid)) map[d].push(sid);
    });
  });
  return map;
}

// Set of dates with a completed mobility (rest-day) session — kept on a
// separate "doneMobility__" key prefix so these never surface in Recent,
// Progression, or All Sessions, which only look at "done__" keys.
function getMobilityDates(log) {
  const dates = new Set();
  Object.keys(log ?? {}).forEach(k => {
    if (!k.startsWith("doneMobility__")) return;
    const rest = k.slice(14);
    const sep  = rest.lastIndexOf("__");
    if (sep < 0) return;
    const date = rest.slice(0, sep);
    if (isValidDate(date) && log[k]) dates.add(date);
  });
  return dates;
}

function getCompletionStats(log, sessId, date, exList) {
  exList = exList ?? EXERCISES[sessId] ?? [];
  if (!exList.length) return { done:0, total:0, pct:0 };
  let done = 0;
  exList.forEach(ex => { const v = log[makeKey(date, sessId, ex.id)]; if (v !== undefined && v !== null) done++; });
  return { done, total: exList.length, pct: Math.round((done / exList.length) * 100) };
}

// Main-workout exercises a user has customised override the shipped defaults
// for that session — warmup/cooldown are never touched by this.
function resolveExercises(customExercises, sessId) {
  const custom = customExercises?.[sessId];
  if (Array.isArray(custom)) return custom;
  return EXERCISES[sessId] ?? [];
}
function resolveAllExercises(customExercises) {
  const out = {};
  Object.keys(EXERCISES).forEach(sid => { out[sid] = resolveExercises(customExercises, sid); });
  return out;
}

// Stable, readable id for a new exercise — slug from name, de-duplicated
// against ids already in use within that session so historical log entries
// never collide.
function makeExerciseId(name, existingIds) {
  let base = (name || "exercise").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) base = "exercise";
  let id = base, n = 2;
  while (existingIds.includes(id)) { id = `${base}_${n}`; n++; }
  return id;
}

// Earliest date with any logged activity, or null if the log is empty
function getEarliestTrainingDate(log) {
  let earliest = null;
  Object.keys(log ?? {}).forEach(k => {
    let d = null;
    if (k.startsWith("done__")) {
      const rest = k.slice(6);
      const sep  = rest.lastIndexOf("__");
      if (sep >= 0) { const date = rest.slice(0, sep); if (isValidDate(date)) d = date; }
    } else {
      const parsed = parseExKey(k);
      if (parsed && log[k] !== null && log[k] !== undefined) d = parsed.date;
    }
    if (d && (!earliest || d < earliest)) earliest = d;
  });
  return earliest;
}

const SK = "jayanth_workout_v7";


// ── Global UI effects CSS ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes _appGlow   { 0%,100%{opacity:.6} 50%{opacity:1} }
  @keyframes _appPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
  @keyframes _appFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes _appSlideR { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes _appShimmer{ from{background-position:-400px 0} to{background-position:400px 0} }
  @keyframes _appSpin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes _appPop    { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
  @keyframes _appBlink  { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes _appOrb    { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(8px,-6px) scale(1.1)} 66%{transform:translate(-6px,4px) scale(.95)} }
  @keyframes _appWave   { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(1.04)} }
  @keyframes _appFlkr   { 0%,94%,100%{opacity:1} 96%{opacity:.2} 98%{opacity:.8} }
  @keyframes _barFill   { from{width:0} to{width:var(--bar-w,100%)} }
  @keyframes _scanH     { from{transform:translateX(-100%)} to{transform:translateX(100vw)} }
  @keyframes _dotPing   { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.5);opacity:0} }

  /* ── NEW in-app effects (GPU only: opacity + transform) ── */
  @keyframes _inGlowPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
  @keyframes _inScanLine  { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  @keyframes _inShimmer   { from{background-position:-600px 0} to{background-position:600px 0} }
  @keyframes _inTickIn    { 0%{transform:scale(0) rotate(-45deg);opacity:0} 60%{transform:scale(1.25) rotate(5deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
  @keyframes _inSlideUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes _inBorderFlow{ 0%,100%{opacity:.35} 50%{opacity:.9} }
  @keyframes _inPrBadge   { 0%{transform:scale(0);opacity:0} 55%{transform:scale(1.18)} 100%{transform:scale(1);opacity:1} }
  @keyframes _inNavPop    { 0%{transform:scale(.82) translateY(6px);opacity:0} 70%{transform:scale(1.06) translateY(-2px)} 100%{transform:scale(1) translateY(0);opacity:1} }
  @keyframes _inBeat      { 0%,100%{transform:scale(1)} 40%{transform:scale(1.12)} 60%{transform:scale(.97)} }
  @keyframes _inFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes _inRingPing  { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
`;
// CSS injected once via module scope
(()=>{if(typeof document!=="undefined"&&!document.getElementById("_appCss")){const el=document.createElement("style");el.id="_appCss";el.textContent=GLOBAL_CSS;document.head.appendChild(el);}})();
// ─────────────────────────────────────────────────────────────────────────────

// ── DEV TEST DATA ────────────────────────────────────────────────────────────
// 30-day simulated training run: train/rest alternating, push→pull→legs→push→pull→sprint cycle
// Weights: +2.5kg/week, -5kg on week 3 (deload), +2.5kg week 4
// Inject via the "Load Test Data" button in Backup & Transfer section
const TEST_STORE = {"log": {"2026-05-29__push__incline_db_press": 24.0, "2026-05-29__push__machine_chest_press": 50.0, "2026-05-29__push__lateral_raises": 8.0, "2026-05-29__push__cable_face_pulls": 14.0, "2026-05-29__push__tricep_pushdown": 18.0, "done__2026-05-29__push": true, "2026-05-31__pull__pullups": true, "2026-05-31__pull__tbar_row": 40.0, "2026-05-31__pull__lat_pulldown_single": 20.0, "2026-05-31__pull__incline_curl": 10.0, "2026-05-31__pull__hammer_curl": 12.0, "2026-05-31__pull__pallof_press": 16.0, "done__2026-05-31__pull": true, "2026-06-02__legs__hip_thrust": 60.0, "2026-06-02__legs__leg_press": 80.0, "2026-06-02__legs__leg_extension": 30.0, "2026-06-02__legs__seated_leg_curl": 28.0, "2026-06-02__legs__seated_calf": 22.0, "2026-06-02__legs__rkc_plank": true, "2026-06-02__legs__back_extension": true, "done__2026-06-02__legs": true, "2026-06-04__push__incline_db_press": 24.0, "2026-06-04__push__machine_chest_press": 50.0, "2026-06-04__push__lateral_raises": 8.0, "2026-06-04__push__cable_face_pulls": 14.0, "2026-06-04__push__tricep_pushdown": 18.0, "done__2026-06-04__push": true, "2026-06-06__pull__pullups": true, "2026-06-06__pull__tbar_row": 42.5, "2026-06-06__pull__lat_pulldown_single": 22.5, "2026-06-06__pull__incline_curl": 12.5, "2026-06-06__pull__hammer_curl": 14.5, "2026-06-06__pull__pallof_press": 18.5, "done__2026-06-06__pull": true, "2026-06-08__sprint__sprint_main": true, "done__2026-06-08__sprint": true, "2026-06-10__push__incline_db_press": 26.5, "2026-06-10__push__machine_chest_press": 52.5, "2026-06-10__push__lateral_raises": 10.5, "2026-06-10__push__cable_face_pulls": 16.5, "2026-06-10__push__tricep_pushdown": 20.5, "done__2026-06-10__push": true, "2026-06-12__pull__pullups": true, "2026-06-12__pull__tbar_row": 45.0, "2026-06-12__pull__lat_pulldown_single": 25.0, "2026-06-12__pull__incline_curl": 15.0, "2026-06-12__pull__hammer_curl": 17.0, "2026-06-12__pull__pallof_press": 21.0, "done__2026-06-12__pull": true, "2026-06-14__legs__hip_thrust": 65.0, "2026-06-14__legs__leg_press": 85.0, "2026-06-14__legs__leg_extension": 35.0, "2026-06-14__legs__seated_leg_curl": 33.0, "2026-06-14__legs__seated_calf": 27.0, "2026-06-14__legs__rkc_plank": true, "2026-06-14__legs__back_extension": true, "done__2026-06-14__legs": true, "2026-06-16__push__incline_db_press": 29.0, "2026-06-16__push__machine_chest_press": 55.0, "2026-06-16__push__lateral_raises": 13.0, "2026-06-16__push__cable_face_pulls": 19.0, "2026-06-16__push__tricep_pushdown": 23.0, "done__2026-06-16__push": true, "2026-06-18__pull__pullups": true, "2026-06-18__pull__tbar_row": 45.0, "2026-06-18__pull__lat_pulldown_single": 25.0, "2026-06-18__pull__incline_curl": 15.0, "2026-06-18__pull__hammer_curl": 17.0, "2026-06-18__pull__pallof_press": 21.0, "done__2026-06-18__pull": true, "2026-06-20__sprint__sprint_main": true, "done__2026-06-20__sprint": true, "2026-06-22__push__incline_db_press": 24.0, "2026-06-22__push__machine_chest_press": 50.0, "2026-06-22__push__lateral_raises": 8.0, "2026-06-22__push__cable_face_pulls": 14.0, "2026-06-22__push__tricep_pushdown": 18.0, "done__2026-06-22__push": true, "2026-06-24__pull__pullups": true, "2026-06-24__pull__tbar_row": 40.0, "2026-06-24__pull__lat_pulldown_single": 20.0, "2026-06-24__pull__incline_curl": 10.0, "2026-06-24__pull__hammer_curl": 12.0, "2026-06-24__pull__pallof_press": 16.0, "done__2026-06-24__pull": true, "2026-06-26__legs__hip_thrust": 62.5, "2026-06-26__legs__leg_press": 82.5, "2026-06-26__legs__leg_extension": 32.5, "2026-06-26__legs__seated_leg_curl": 30.5, "2026-06-26__legs__seated_calf": 24.5, "2026-06-26__legs__rkc_plank": true, "2026-06-26__legs__back_extension": true, "done__2026-06-26__legs": true, "2026-06-28__push__incline_db_press": 26.5, "2026-06-28__push__machine_chest_press": 52.5, "2026-06-28__push__lateral_raises": 10.5, "2026-06-28__push__cable_face_pulls": 16.5, "2026-06-28__push__tricep_pushdown": 20.5, "done__2026-06-28__push": true}, "customExercises": {}, "customWarmups": {}, "customCooldowns": {}};
// ─────────────────────────────────────────────────────────────────────────────
function lsLoad() {
  try {
    const r=localStorage.getItem(SK);
    const p=r?JSON.parse(r):{};
    const log = (p&&typeof p.log==="object"&&!Array.isArray(p.log)) ? p.log : {};
    const customExercises = (p&&typeof p.customExercises==="object"&&!Array.isArray(p.customExercises)) ? p.customExercises : {};
    const rawWarmups = (p&&typeof p.customWarmups==="object"&&!Array.isArray(p.customWarmups)) ? p.customWarmups : {};
    const rawCooldowns = (p&&typeof p.customCooldowns==="object"&&!Array.isArray(p.customCooldowns)) ? p.customCooldowns : {};
    const rawMobility = (p&&typeof p.customMobility==="object"&&!Array.isArray(p.customMobility)) ? p.customMobility : {};
    // Strip empty arrays so defaults always show when nothing meaningful saved
    const customWarmups = Object.fromEntries(Object.entries(rawWarmups).filter(([,v])=>Array.isArray(v)&&v.length>0));
    const customCooldowns = Object.fromEntries(Object.entries(rawCooldowns).filter(([,v])=>Array.isArray(v)&&v.length>0));
    const customMobility = Object.fromEntries(Object.entries(rawMobility).filter(([,v])=>Array.isArray(v)&&v.length>0));
    return { log, customExercises, customWarmups, customCooldowns, customMobility };
  } catch(_){ return {log:{},customExercises:{},customWarmups:{},customCooldowns:{},customMobility:{}}; }
}
function lsSave(d) { try { localStorage.setItem(SK,JSON.stringify(d)); } catch(_){} }

function useDebouncedEffect(fn, deps, delay) {
  const t=useRef(null);
  useEffect(()=>{ t.current&&clearTimeout(t.current); t.current=setTimeout(fn,delay); return ()=>{ t.current&&clearTimeout(t.current); }; },deps);
}

function Card({children,style,glow}){
  const g=glow||"transparent";
  return(
    <div style={{background:C.card,border:`1px solid ${glow?g+"44":C.border}`,borderRadius:12,
      boxShadow:glow?`0 0 22px ${g}28, 0 2px 8px #00000044`:"0 2px 8px #00000033",
      position:"relative",overflow:"hidden",...style}}>
      {glow&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,
        background:`linear-gradient(90deg,transparent,${g}aa,transparent)`,
        backgroundSize:"200% 100%",animation:"_inShimmer 2.2s linear 1",opacity:.85}}/>}
      {children}
    </div>
  );
}
function Button({children,onClick,variant="primary",color,style}){
  const c=color||C.gold;
  const isPrimary=variant==="primary";
  return(
    <button onClick={onClick} style={{
      background:isPrimary?`linear-gradient(135deg,${c}22,${c}11)`:C.surfaceHi,
      border:`1.5px solid ${c}${isPrimary?"99":"44"}`,
      borderRadius:10,color:c,fontSize:14,fontFamily:"Georgia,serif",
      padding:`${SP.sm}px ${SP.md}px`,cursor:"pointer",
      boxShadow:isPrimary?`0 0 22px ${c}44, 0 0 40px ${c}11`:"none",
      textShadow:isPrimary?`0 0 12px ${c}`:"none",
      position:"relative",overflow:"hidden",
      transition:"all .2s ease",
      ...style
    }}>
      {/* animated top border glow */}
      {isPrimary&&<div style={{position:"absolute",top:0,left:0,right:0,height:1.5,
        background:`linear-gradient(90deg,transparent,${c}88,transparent)`,
        backgroundSize:"200% 100%",
        animation:"_inShimmer 1.8s linear 1"}}/>}
      {/* shimmer sweep */}
      {isPrimary&&<div style={{position:"absolute",inset:0,
        background:"linear-gradient(105deg,transparent 30%,rgba(255,255,255,.12) 50%,transparent 70%)",
        backgroundSize:"300% 100%",
        animation:"_inShimmer 2.5s linear 1",pointerEvents:"none"}}/>}
      {children}
    </button>
  );
}
function StatCard({label,value,color}){
  const c=color||C.gold;
  return(
    <div style={{background:C.surfaceHi,border:`1px solid ${c}33`,borderRadius:10,padding:`${SP.sm}px`,textAlign:"center",
      boxShadow:`0 0 18px ${c}28, 0 0 1px ${c}44`,position:"relative",overflow:"hidden",
      animation:"_appFadeIn .45s cubic-bezier(.22,1,.36,1) both"}}>
      {/* animated shimmer top bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,
        background:`linear-gradient(90deg,transparent,${c},transparent)`,
        backgroundSize:"200% 100%",
        animation:"_inShimmer 2.4s linear 1",opacity:.75}}/>
      {/* subtle radial glow behind value */}
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 30%,${c}0e 0%,transparent 70%)`,
        animation:"_inGlowPulse 3s ease-in-out 2",pointerEvents:"none"}}/>
      <div style={{fontSize:26,color:c,fontWeight:700,lineHeight:1,marginBottom:5,
        textShadow:`0 0 16px ${c}, 0 0 32px ${c}44`,position:"relative",
        animation:"_inBeat 3.5s ease-in-out 2"}}>{value}</div>
      <div style={{fontSize:8,color:C.textLow,letterSpacing:1,fontFamily:"monospace",textTransform:"uppercase",position:"relative"}}>{label}</div>
    </div>
  );
}
function SectionHeader({children,color}){
  const col=color||C.textMid;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:SP.sm,animation:"_inSlideUp .35s ease both"}}>
      <div style={{width:3,height:14,borderRadius:2,background:col,
        boxShadow:`0 0 8px ${col}99`,flexShrink:0,
        animation:"_inGlowPulse 2.8s ease-in-out 2"}}/>
      <div style={{fontSize:9,color:col,letterSpacing:3,textTransform:"uppercase",fontFamily:"monospace",
        textShadow:`0 0 8px ${col}66`}}>{children}</div>
      {/* animated trailing line */}
      <div style={{flex:1,height:1,background:`linear-gradient(90deg,${col}55,transparent)`,
        animation:"_inShimmer 3s linear 1",backgroundSize:"300% 100%"}}/>
    </div>
  );
}
function Divider(){
  return(
    <div style={{margin:`${SP.md}px 0`,display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,height:1,background:`linear-gradient(90deg,transparent,${C.border}88,transparent)`,
        backgroundSize:"200% 100%",animation:"_inShimmer 3.5s linear 1"}}/>
      <div style={{width:4,height:4,borderRadius:"50%",background:C.border,opacity:.6,
        animation:"_inBeat 3s ease-in-out 2"}}/>
      <div style={{flex:1,height:1,background:`linear-gradient(90deg,transparent,${C.border}88,transparent)`,
        backgroundSize:"200% 100%",animation:"_inShimmer 3.5s linear .5s 1"}}/>
    </div>
  );
}
function Expand({label,accent,children,defaultOpen}){
  const [open,setOpen]=useState(!!defaultOpen);
  const col=accent||C.textMid;
  return(
    <div style={{marginBottom:SP.sm}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:open?`${col}12`:`${col}07`,
        border:`1px solid ${open?col+"66":col+"33"}`,borderRadius:9,padding:"10px 14px",
        cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
        fontFamily:"Georgia,serif",color:col,fontSize:13,
        boxShadow:open?`0 0 14px ${col}44, inset 0 0 10px ${col}08`:"none",
        transition:"all .22s ease",position:"relative",overflow:"hidden"}}>
        {/* shimmer sweep on open */}
        {open&&<div style={{position:"absolute",inset:0,
          background:"linear-gradient(105deg,transparent 20%,rgba(255,255,255,.06) 50%,transparent 80%)",
          backgroundSize:"300% 100%",animation:"_inShimmer 2s linear 1",pointerEvents:"none"}}/>}
        <span style={{textShadow:open?`0 0 10px ${col}88`:"none",position:"relative"}}>{label}</span>
        <span style={{fontSize:11,opacity:.75,transition:"transform .22s",display:"inline-block",
          transform:open?"rotate(180deg)":"rotate(0deg)",willChange:"transform",position:"relative"}}>▾</span>
      </button>
      {open&&<div style={{background:`${col}05`,border:`1px solid ${col}18`,borderTop:"none",borderRadius:"0 0 9px 9px",padding:"10px 14px 12px"}}>{children}</div>}
    </div>
  );
}

function SplashScreen({onDone}){
  const [s,setS]=useState(0);
  const [pgPct,setPgPct]=useState(0);

  useEffect(()=>{
    const t=[
      setTimeout(()=>setS(1),60),
      setTimeout(()=>setS(2),2900),
      setTimeout(()=>onDone(),3300),
    ];
    return()=>t.forEach(clearTimeout);
  },[]);

  useEffect(()=>{
    const id=setInterval(()=>setPgPct(p=>p>=100?100:p+2.4),65);
    return()=>clearInterval(id);
  },[]);

  // 30 dots + twinkle stars + corner brackets — still only transform+opacity
  // (GPU-composited), no filters/blur, no animated shadows. Pushed further
  // than the previous pass; if this stutters, the dot/star counts below are
  // the first things to cut back.
  const dots=useMemo(()=>Array.from({length:30},(_,i)=>({
    x:6+((i*23)%88), y:6+((i*37)%88),
    dur:1.8+(i%5)*.3, delay:(i%7)*.22,
  })),[]);
  const stars=useMemo(()=>Array.from({length:14},(_,i)=>({
    x:12+((i*53)%76), y:12+((i*31)%76),
    dur:1.2+(i%4)*.25, delay:(i%6)*.3,
  })),[]);

  return(
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:2000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden",fontFamily:"monospace",opacity:s>=2?0:1,transition:s>=2?"opacity .35s ease":"none"}}>
      <style>{`
        @keyframes _spFade   {from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
        @keyframes _spPulse  {0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.6;transform:scale(1.08)}}
        @keyframes _spDot    {0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:.7;transform:scale(1)}}
        @keyframes _spStar   {0%,100%{opacity:.1;transform:scale(.6)}50%{opacity:.9;transform:scale(1.15)}}
        @keyframes _spScan   {0%{transform:translateY(-130px);opacity:0}10%{opacity:.5}90%{opacity:.5}100%{transform:translateY(130px);opacity:0}}
        @keyframes _spCorner {from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes _spText   {0%,100%{opacity:.5}50%{opacity:1}}
      `}</style>

      {/* faint drifting dots — transform+opacity only, no shadows/filters */}
      {dots.map((d,i)=>(
        <div key={i} style={{position:"absolute",left:`${d.x}%`,top:`${d.y}%`,width:3,height:3,borderRadius:"50%",
          background:"#e21c1a",opacity:.3,
          animation:`_spDot ${d.dur}s ease-in-out ${d.delay}s infinite`,willChange:"transform,opacity"}}/>
      ))}

      {/* tiny twinkling stars — separate timing/size from the dots above for visual variety */}
      {stars.map((d,i)=>(
        <div key={`st${i}`} style={{position:"absolute",left:`${d.x}%`,top:`${d.y}%`,width:1.5,height:1.5,borderRadius:"50%",
          background:"#ffffff",opacity:.4,
          animation:`_spStar ${d.dur}s ease-in-out ${d.delay}s infinite`,willChange:"transform,opacity"}}/>
      ))}

      {/* pulsing glow ring */}
      <div style={{position:"absolute",width:230,height:230,borderRadius:"50%",
        background:"radial-gradient(circle,#e21c1a22 0%,transparent 65%)",
        animation:"_spPulse 2.6s ease-in-out infinite",willChange:"transform,opacity"}}/>

      {/* vertical scan sweep through the logo zone — translateY+opacity, composited */}
      <div style={{position:"absolute",width:170,height:2,background:"linear-gradient(90deg,transparent,#e21c1a55,transparent)",
        animation:"_spScan 2.4s ease-in-out infinite",willChange:"transform,opacity"}}/>

      {/* corner brackets framing the lockup — static position, single fade-in each, no per-frame cost after mount */}
      {[["8%","8%",0,0],["92%","8%",1,0],["8%","92%",0,1],["92%","92%",1,1]].map(([l,t,fx,fy],i)=>(
        <div key={i} style={{position:"absolute",left:l,top:t,width:16,height:16,
          borderTop:fy?"none":"1.5px solid #e21c1a55",borderBottom:fy?"1.5px solid #e21c1a55":"none",
          borderLeft:fx?"none":"1.5px solid #e21c1a55",borderRight:fx?"1.5px solid #e21c1a55":"none",
          transform:`translate(${fx?-100:0}%,${fy?-100:0}%)`,
          opacity:s>=1?1:0,animation:s===1?`_spCorner .5s ease ${.1+i*.06}s both`:"none"}}/>
      ))}

      <div style={{position:"relative",opacity:s>=1?1:0,animation:s===1?"_spFade .45s ease both":"none"}}>
        <img src={ICON_DATA_URI} width={148} height={148} alt="J Shield" style={{display:"block",objectFit:"contain"}}/>
      </div>

      <div style={{marginTop:16,fontSize:12,letterSpacing:3,color:"#e21c1ad0",textTransform:"uppercase",fontWeight:700,
        opacity:s>=1?1:0,animation:s===1?"_spFade .5s ease .15s both":"none"}}>Journey to Strength</div>

      <div style={{position:"absolute",bottom:64,left:"14%",right:"14%"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:7.5,color:"#e21c1a99",letterSpacing:2,fontFamily:"monospace",animation:"_spText 1.4s ease-in-out infinite"}}>LOADING</span>
          <span style={{fontSize:8,color:"#e21c1acc",fontFamily:"monospace",fontWeight:700}}>{pgPct}%</span>
        </div>
        <div style={{height:4,background:"#0d0000",borderRadius:3,overflow:"hidden",border:"1px solid #e21c1a22"}}>
          <div style={{height:"100%",borderRadius:3,background:"#e21c1a",
            width:`${pgPct}%`,transition:"width .15s linear"}}/>
        </div>
      </div>
    </div>
  );
}


function JShieldSVG({size=44,glow=false}){
  // Traced from reference icon image:
  // Classic Superman pentagon shield — red outer, yellow inner face.
  // J letter: full-width crossbar with DIAGONAL bottom-left cut (signature asymmetry),
  //           thick right vertical stem, bold semicircular hook with yellow inner ring.
  // ViewBox 200×216 maps naturally to the shield proportions.
  return(
    <svg width={size} height={Math.round(size*216/200)} viewBox="0 0 200 216"
      style={{display:"block",overflow:"visible"}} xmlns="http://www.w3.org/2000/svg">
      {glow&&<defs>
        <filter id="jg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>
          <feColorMatrix in="b" values="1 0 0 0 .9  0 0 0 0 0  0 0 0 0 0  0 0 0 3.5 0" result="r"/>
          <feMerge><feMergeNode in="r"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>}
      <g filter={glow?"url(#jg)":"none"}>

        {/* ── OUTER RED SHIELD — classic Superman diamond pentagon ── */}
        <path fill="#e41414" d="
          M 22,4 L 178,4
          C 198,4 202,22 198,58
          L 100,214
          L 2,58
          C -2,22 2,4 22,4 Z"/>

        {/* ── YELLOW INNER FACE ── */}
        <path fill="#f5e000" d="
          M 40,20 L 160,20
          C 178,20 180,36 176,66
          L 100,198
          L 24,66
          C 20,36 22,20 40,20 Z"/>

        {/* ── J: CROSSBAR + STEM as one polygon ──
            Crossbar is full width (40→162) at top, but the BOTTOM-LEFT edge
            cuts diagonally — this is the key signature from the reference image.
            The diagonal goes from (40,36) up-right to (72,54).
            Right side stays straight; stem continues down from x=124. */}
        <polygon points="
          40,20  162,20
          162,158
          144,158  144,54
          72,54   40,36
        " fill="#e41414"/>

        {/* ── YELLOW RESTORE TRIANGLE — below the diagonal cut ──
            Gives back the yellow in the bottom-left corner of the crossbar area */}
        <polygon points="40,36 72,54 40,54" fill="#f5e000"/>

        {/* ── J: HOOK OUTER RED RING ──
            Semicircular ring sweeping from right side of stem (x≈144)
            leftward and back up. Center approx (100,172). */}
        <path fill="#e41414" d="
          M 62,158 L 62,142
          C 44,142 32,156 32,172
          C 32,198 58,214 100,214
          C 142,214 168,198 168,172
          C 168,156 156,142 138,142
          L 138,158
          C 148,158 152,164 152,172
          C 152,190 130,202 100,202
          C 70,202 48,190 48,172
          C 48,164 54,158 62,158 Z"/>

        {/* ── J: INNER YELLOW of hook ──
            Fills the space inside the hook ring, revealing yellow face */}
        <path fill="#f5e000" d="
          M 62,142 L 62,158
          C 54,158 48,164 48,172
          C 48,190 70,202 100,202
          C 130,202 152,190 152,172
          C 152,164 148,158 138,158
          L 138,142
          C 156,142 168,156 168,172
          C 168,198 142,214 100,214
          C 58,214 32,198 32,172
          C 32,156 44,142 62,142 Z"/>

      </g>
    </svg>
  );
}

function AppLogo({size=44}){
  return <img src={ICON_DATA_URI} width={size} height={size} alt="J Shield" style={{display:"block",objectFit:"contain"}}/>;
}

function DigitalClock({mode,onToggle}){
  const [now,setNow]=useState(new Date());
  const [alarmTime,setAlarmTime]=useState(""); // "HH:MM" string
  const [alarmSet,setAlarmSet]=useState(false);
  const [showPicker,setShowPicker]=useState(false);
  const [pickerVal,setPickerVal]=useState("06:00");
  const [fired,setFired]=useState(false);

  useEffect(()=>{
    const id=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(id);
  },[]);

  // Check alarm every second
  useEffect(()=>{
    if(!alarmSet||fired) return;
    const hh=String(now.getHours()).padStart(2,"0");
    const mm=String(now.getMinutes()).padStart(2,"0");
    const cur=`${hh}:${mm}`;
    const ss=now.getSeconds();
    if(cur===alarmTime && ss===0){
      setFired(true);
      // Vibration only — no audio
      try{
        if(navigator.vibrate){
          // Pattern: 300ms on, 100ms off × 6 times
          navigator.vibrate([300,100,300,100,300,100,300,100,300,100,300]);
        }
      }catch(_){}
      // Auto-clear after 10 s
      setTimeout(()=>{ setAlarmSet(false); setAlarmTime(""); setFired(false); },10000);
    }
  },[now,alarmSet,alarmTime,fired]);

  function setAlarm(){
    setAlarmTime(pickerVal);
    setAlarmSet(true);
    setFired(false);
    setShowPicker(false);
  }
  function cancelAlarm(){
    setAlarmSet(false);
    setAlarmTime("");
    setFired(false);
    setShowPicker(false);
  }

  const days2=["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const months2=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const hh=String(now.getHours()).padStart(2,"0");
  const mm2=String(now.getMinutes()).padStart(2,"0");
  const ss=String(now.getSeconds()).padStart(2,"0");

  const alarmBtnColor = fired?"#ff4444":alarmSet?"#1e8449":C.textMid;

  return (
    <div style={{position:"absolute",top:8,right:12,zIndex:998,textAlign:"right",fontFamily:"monospace"}}>
      {/* Date row + theme toggle */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6,marginBottom:1}}>
        <div style={{fontSize:11,color:C.textMid,letterSpacing:1,pointerEvents:"none"}}>{days2[now.getDay()]} · {now.getDate()} {months2[now.getMonth()]}</div>
        <button onClick={onToggle} aria-label="Toggle dark/light mode"
          style={{width:18,height:18,borderRadius:"50%",border:`1px solid ${C.borderHi}`,
            background:C.surfaceHi,color:C.gold,fontSize:9,lineHeight:"16px",
            padding:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {mode==="light"?"☀":"☾"}
        </button>
      </div>

      {/* Time */}
      <div style={{fontSize:17,color:C.gold,letterSpacing:0.5,fontWeight:700,pointerEvents:"none"}}>{hh}:{mm2}:{ss}</div>

      {/* Alarm button */}
      <div style={{marginTop:4,display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>{ if(alarmSet) cancelAlarm(); else setShowPicker(p=>!p); }}
          aria-label={alarmSet?"Cancel alarm":"Set alarm"}
          style={{
            fontSize:9,fontFamily:"monospace",letterSpacing:1,
            padding:"3px 7px",borderRadius:5,cursor:"pointer",
            background:"none",
            border:`1px solid ${alarmBtnColor}`,
            color:alarmBtnColor,
            transition:"all 0.2s",
          }}>
          {fired?"🔔 BUZZ":alarmSet?`⏰ ${alarmTime} ✕`:"⏰ ALARM"}
        </button>
      </div>

      {/* Time picker popup */}
      {showPicker && !alarmSet && (
        <div style={{
          position:"absolute",top:"100%",right:0,marginTop:6,
          background:C.card,border:`1px solid ${C.borderHi}`,
          borderRadius:10,padding:12,minWidth:160,
          boxShadow:"0 8px 32px #00000088",zIndex:999,
          textAlign:"center",
        }}>
          <div style={{fontSize:9,color:C.textLow,letterSpacing:2,marginBottom:8}}>SET ALARM</div>
          <input type="time" value={pickerVal}
            onChange={e=>setPickerVal(e.target.value)}
            style={{
              width:"100%",background:C.surfaceHi,
              border:`1px solid ${C.borderHi}`,borderRadius:6,
              color:C.text,fontSize:18,fontWeight:700,
              padding:"6px 8px",outline:"none",
              fontFamily:"monospace",textAlign:"center",
              colorScheme: mode==="light"?"light":"dark",
              boxSizing:"border-box",
            }}/>
          <div style={{fontSize:9,color:C.textLow,marginTop:6,marginBottom:8}}>Vibration only — no sound</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <button onClick={setAlarm}
              style={{background:"#1e8449",border:"none",borderRadius:6,
                color:"#fff",fontSize:11,padding:"7px 0",cursor:"pointer",fontFamily:"monospace"}}>
              SET
            </button>
            <button onClick={()=>setShowPicker(false)}
              style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,
                color:C.textMid,fontSize:11,padding:"7px 0",cursor:"pointer",fontFamily:"monospace"}}>
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecoveryBar({label,icon,color,days}){
  const maxDays=8;
  const pct=days==null?100:Math.min(100,(days/maxDays)*100);
  const text=days==null?"Never trained":days===0?"Today":days===1?"1 day ago":`${days} days ago`;
  const fresh=days!=null&&days<=2;
  return(
    <div style={{marginBottom:13,animation:"_appFadeIn .5s ease both"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5,alignItems:"center"}}>
        <span style={{color,textShadow:`0 0 8px ${color}99`,fontWeight:fresh?700:400,display:"flex",alignItems:"center",gap:5}}>
          {icon} {label}
          {fresh&&<span style={{fontSize:8,background:color+"22",border:`1px solid ${color}44`,borderRadius:3,padding:"1px 5px",letterSpacing:1,fontFamily:"monospace"}}>READY</span>}
        </span>
        <span style={{fontSize:10,color:days===0?color:C.textMid,fontFamily:"monospace"}}>{text}</span>
      </div>
      <div style={{height:8,background:C.surfaceHi,borderRadius:5,overflow:"hidden",border:`1px solid ${color}22`,position:"relative"}}>
        <div style={{height:"100%",width:`${pct}%`,
          background:`linear-gradient(90deg,${color}77,${color},${color}cc)`,
          borderRadius:5,transition:"width 0.7s cubic-bezier(.22,1,.36,1)",
          boxShadow:`0 0 12px ${color}99, 0 0 24px ${color}44`}}/>
        {/* shimmer sweep across fill */}
        {pct>0&&<div style={{position:"absolute",top:0,left:0,height:"100%",width:`${pct}%`,
          background:"linear-gradient(90deg,transparent 20%,rgba(255,255,255,.22) 50%,transparent 80%)",
          backgroundSize:"200% 100%",animation:"_inShimmer 1.8s linear 1",pointerEvents:"none"}}/>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
        {[0,25,50,75,100].map(v=>(
          <div key={v} style={{width:1,height:3,background:pct>=v?color+99:C.border,transition:"background .4s"}}/>
        ))}
      </div>
    </div>
  );
}

function Heatmap({log,themeMode}){
  const scrollRef = useRef(null);
  const today = new Date(todayStr()+"T00:00:00");
  // Literal hex (not a CSS var) so it can be alpha-suffixed below —
  // white reads against the dark theme, black reads against the light theme.
  const MOBILITY_COLOR = themeMode==="light" ? "#000000" : "#ffffff";

  // Start at the beginning of the current month by default — if there's logged
  // history from before that, extend back to cover it instead of showing a year
  // of empty pre-history.
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const earliestLogged = getEarliestTrainingDate(log);
  let start = startOfMonth;
  if (earliestLogged) {
    const ed = new Date(earliestLogged+"T00:00:00");
    if (ed < startOfMonth) start = ed;
  }
  start = new Date(start);
  start.setDate(start.getDate()-start.getDay()); // snap back to Sunday

  const trainMap = getAllTrainingDates(log);
  const mobilitySet = getMobilityDates(log);
  const dayCells = [];
  for(let d=new Date(start); d<=today; d.setDate(d.getDate()+1)){
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    dayCells.push({ date:ds, dow:d.getDay(), month:d.getMonth(), sessIds:trainMap[ds]??[], mobility:mobilitySet.has(ds) });
  }

  const cols=[]; let col=[];
  dayCells.forEach((d,i)=>{ col.push(d); if(d.dow===6||i===dayCells.length-1){ cols.push(col); col=[]; } });

  const priority=["push","pull","legs","sprint"];
  const colorFor = sessIds => {
    if(!sessIds.length) return null;
    const pick = priority.find(p=>sessIds.includes(p)) ?? sessIds[0];
    return SESSIONS.find(s=>s.id===pick)?.color ?? C.gold;
  };

  // month label above the column where that month first starts
  let lastMonth=-1;
  const monthLabels = cols.map(col=>{
    const first = col.find(d=>d.month!==lastMonth);
    if(first){ lastMonth=first.month; return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][first.month]; }
    return "";
  });

  // Open scrolled to the current/most-recent month rather than January
  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  },[]);

  return (
    <div>
      <div ref={scrollRef} style={{overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch"}}>
        <div style={{display:"inline-block"}}>
          <div style={{display:"flex",gap:3,marginBottom:3}}>
            {cols.map((c,i)=>(
              <div key={i} style={{width:11,fontSize:7,color:C.textLow,fontFamily:"monospace"}}>{monthLabels[i]}</div>
            ))}
          </div>
          <div style={{display:"flex",gap:3}}>
            {cols.map((colArr,ci)=>(
              <div key={ci} style={{display:"flex",flexDirection:"column",gap:3}}>
                {Array.from({length:7}).map((_,ri)=>{
                  const cell = colArr.find(d=>d.dow===ri);
                  if(!cell) return <div key={ri} style={{width:11,height:11}}/>;
                  const col2 = colorFor(cell.sessIds);
                  const cellColor = col2 ?? (cell.mobility ? MOBILITY_COLOR : null);
                  const isToday = cell.date===todayStr();
                  return <div key={ri} title={`${cell.date}${cell.sessIds.length?` · ${cell.sessIds.join(", ")}`:""}${cell.mobility?` · Mobility`:""}`}
                    style={{width:11,height:11,borderRadius:2,
                      background: cellColor ? cellColor+"d0" : C.surfaceHi,
                      border: isToday ? `1.5px solid ${C.gold}` : cell.mobility&&col2 ? `1px solid ${MOBILITY_COLOR}` : `1px solid ${C.border}`,
                      boxShadow: isToday ? `0 0 6px ${C.gold}88` : cellColor ? `0 0 4px ${cellColor}66` : "none",
                      boxSizing:"border-box",
                      animation: isToday ? "_inBeat 2.5s ease-in-out 2" : (cellColor?"_appFadeIn .3s ease both":"none")}}/>;
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
        {SESSIONS.map(s=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:9,height:9,borderRadius:2,background:s.color+"d0"}}/>
            <span style={{fontSize:9,color:C.textLow}}>{s.label.split(" ")[0]}</span>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:9,height:9,borderRadius:2,background:MOBILITY_COLOR+"d0",border:`1px solid ${MOBILITY_COLOR}`}}/>
          <span style={{fontSize:9,color:C.textLow}}>Mobility</span>
        </div>
      </div>
    </div>
  );
}

function getLastWeight(log,sid,eid,beforeDate){ const e=Object.entries(log??{}).filter(([k,v])=>{const p=parseExKey(k);return p&&p.sessId===sid&&p.exId===eid&&typeof v==="number"&&!isNaN(v)&&v>0&&p.date<beforeDate;}).sort(([a],[b])=>a.localeCompare(b)); return e.length?e[e.length-1][1]:null; }
function getAllWeights(log,sid,eid){ return Object.entries(log??{}).filter(([k,v])=>{const p=parseExKey(k);return p&&p.sessId===sid&&p.exId===eid&&typeof v==="number"&&!isNaN(v)&&v>0;}).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v); }

function ExRow({ex,accent,logKey,logVal,onLog,lastWeight}){
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState(false);
  const [inp,setInp]=useState("");
  const done=logVal!==undefined&&logVal!==null;
  return <div style={{background:C.surfaceHi,border:`1.5px solid ${open?accent+"77":done?accent+"33":C.border}`,borderRadius:10,marginBottom:8,overflow:"hidden",boxShadow:open?`0 0 12px ${accent}22`:done?`0 0 6px ${accent}18`:"none",transition:"border-color .2s,box-shadow .2s",willChange:"auto"}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 44px 66px 80px",gap:6,padding:"10px 12px",alignItems:"center",cursor:"pointer"}} onClick={()=>setOpen(o=>!o)}>
      <div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.3,display:"flex",alignItems:"center",gap:6}}>
          <span>{ex.icon} {ex.name}</span>
          {done&&<span style={{fontSize:9,color:accent,background:accent+"22",border:`1px solid ${accent}55`,borderRadius:4,padding:"1px 5px",fontFamily:"monospace",letterSpacing:.5,
            boxShadow:`0 0 8px ${accent}66`,
            animation:"_inTickIn .4s cubic-bezier(.22,1.8,.4,1) both"}}>✓</span>}
        </div>
        <div style={{fontSize:9,color:C.textLow,marginTop:2}}>
          {ex.sets} sets · {ex.reps}
          {ex.tempo && <> · tempo {ex.tempo}</>}
          {ex.rest && <> · rest {ex.rest}</>}
          {lastWeight && <span style={{color:accent+"99",marginLeft:6,fontFamily:"monospace"}}>↑{lastWeight}kg</span>}
        </div>
      </div>
      <div style={{textAlign:"center"}}><div style={{fontSize:7,color:C.textLow,marginBottom:2,letterSpacing:1,fontFamily:"monospace"}}>SETS</div><div style={{fontSize:18,color:accent,fontWeight:700,lineHeight:1,textShadow:`0 0 8px ${accent}66`}}>{ex.sets}</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:7,color:C.textLow,marginBottom:2,letterSpacing:1,fontFamily:"monospace"}}>REPS</div><div style={{fontSize:11,color:C.textMid}}>{ex.reps}</div></div>
      <div style={{textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        {ex.weighted?(editing?<div style={{display:"flex",flexDirection:"column",gap:3}}><input autoFocus value={inp} onChange={e=>setInp(e.target.value)} type="number" placeholder={lastWeight?`${lastWeight}kg`:"kg"} style={{width:"100%",background:C.surfaceHi,border:`1px solid ${accent}`,borderRadius:4,color:C.text,fontSize:12,padding:"4px 5px",textAlign:"center",outline:"none",boxSizing:"border-box"}}/><div style={{display:"flex",gap:3}}><button onClick={()=>{const n=parseFloat(inp);if(inp!==""&&!isNaN(n)&&n>0)onLog(logKey,n);setEditing(false);}} style={{flex:1,background:accent,border:"none",borderRadius:3,color:"#fff",fontSize:10,padding:"3px 0",cursor:"pointer"}}>✓</button><button onClick={()=>setEditing(false)} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:3,color:C.textMid,fontSize:10,padding:"3px 0",cursor:"pointer"}}>✕</button></div></div>:<button onClick={()=>{setEditing(true);setInp(done?String(logVal):"");}} style={{background:done?accent+"22":C.card,border:`1px solid ${done?accent:C.borderHi}`,borderRadius:6,color:done?accent:C.textMid,fontSize:11,padding:"6px 4px",cursor:"pointer",width:"100%",fontFamily:"Georgia,serif"}}>{done?`${logVal} kg`:"Enter kg"}</button>):<button onClick={()=>onLog(logKey,done?null:true)} style={{background:done?C.ok+"22":C.card,border:`1px solid ${done?C.ok:C.borderHi}`,borderRadius:6,color:done?C.ok:C.textMid,fontSize:11,padding:"6px 4px",cursor:"pointer",width:"100%",fontFamily:"Georgia,serif"}}>{done?"✓ Done":"Mark done"}</button>}
      </div>
    </div>
    {open&&<div style={{borderTop:`1px solid ${accent}33`,padding:"10px 14px 14px",background:accent+"08",position:"relative",animation:"_inSlideUp .25s ease both"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:2.5,
        background:`linear-gradient(180deg,${accent},${accent}55)`,borderRadius:"0 2px 2px 0",
        boxShadow:`2px 0 8px ${accent}44`,
        animation:"_inGlowPulse 2.5s ease-in-out 2"}}/>
      {lastWeight&&<div style={{marginBottom:8,fontSize:11,color:C.textMid}}>Last session: <span style={{color:accent,fontWeight:700}}>{lastWeight} kg</span>{done&&logVal>lastWeight&&<span style={{color:C.ok,marginLeft:6,display:"inline-flex",alignItems:"center",gap:3,
  background:C.ok+"18",border:`1px solid ${C.ok}44`,borderRadius:4,padding:"1px 7px",
  boxShadow:`0 0 10px ${C.ok}55`,animation:"_inPrBadge .5s cubic-bezier(.22,1.8,.4,1) both"}}>▲ +{(logVal-lastWeight).toFixed(1)} kg PR</span>}</div>}
      {ex.tempo&&<div style={{fontSize:11,color:accent,marginBottom:6}}>Tempo: <b>{ex.tempo}</b></div>}
      {ex.focus&&<div style={{fontSize:11,color:C.textMid,lineHeight:1.65,marginBottom:6}}>{ex.focus}</div>}
      {ex.warn&&<div style={{background:C.warn+"0e",border:`1px solid ${C.warn}28`,borderRadius:5,padding:"6px 10px",fontSize:11,color:C.warn+"cc",marginBottom:6}}>⚠ {ex.warn}</div>}
    </div>}
  </div>;
}

function Graph({exId,sessId,exName,accent,log}){
  const [view,setView]=useState("all");
  const [chartType,setChartType]=useState("line"); // "line" | "bar"
  const [hovIdx,setHovIdx]=useState(null);
  const [showTrend,setShowTrend]=useState(true);
  const svgRef=useRef(null);

  const all=Object.entries(log??{}).filter(([k,v])=>{const parsed=parseExKey(k);return parsed&&parsed.sessId===sessId&&parsed.exId===exId&&typeof v==="number"&&!isNaN(v)&&v>0;}).map(([k,v])=>({date:parseExKey(k).date,val:v})).sort((a,b)=>a.date.localeCompare(b.date));
  const byW={};all.forEach(e=>{const wk=getWeekLabel(e.date);if(!byW[wk]||e.val>byW[wk].val)byW[wk]={label:wk,val:e.val,date:e.date};});
  const byM={};all.forEach(e=>{const mk=e.date.slice(0,7);if(!byM[mk]||e.val>byM[mk].val)byM[mk]={label:getMonthLabel(e.date),val:e.val,date:e.date};});
  const entries=view==="week"?Object.values(byW).sort((a,b)=>a.date.localeCompare(b.date)).slice(-12):view==="month"?Object.values(byM).sort((a,b)=>a.date.localeCompare(b.date)).slice(-12):all.slice(-20);

  if(all.length===0)return(
    <div style={{padding:`${SP.xl}px ${SP.md}px`,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:SP.sm}}>📈</div>
      <div style={{fontSize:12,color:C.textLow}}>No data yet for {exName}</div>
      <div style={{fontSize:10,color:C.textLow,marginTop:4}}>Log a weight to start tracking</div>
    </div>
  );

  const Tabs=()=>(
    <div style={{display:"flex",gap:4}}>
      {["all","week","month"].map(v=>(
        <button key={v} onClick={()=>setView(v)} style={{padding:"4px 8px",background:view===v?accent+"22":C.card,border:`1px solid ${view===v?accent:C.border}`,borderRadius:5,color:view===v?accent:C.textMid,fontSize:9,cursor:"pointer",fontFamily:"monospace",letterSpacing:1}}>
          {v==="all"?"ALL":v==="week"?"WK":"MO"}
        </button>
      ))}
    </div>
  );

  if(entries.length<2)return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:SP.sm}}>
        <div style={{fontSize:12,color:C.text,fontWeight:700}}>{exName}</div><Tabs/>
      </div>
      <div style={{textAlign:"center",padding:`${SP.md}px 0`}}>
        <div style={{fontSize:36,color:accent,fontWeight:700,textShadow:`0 0 20px ${accent}66`}}>{entries[0]?.val??0}<span style={{fontSize:14,color:C.textMid,marginLeft:4}}>kg</span></div>
        <div style={{fontSize:10,color:C.textLow,marginTop:4}}>1 session logged — keep going!</div>
      </div>
    </div>
  );

  const vals=entries.map(e=>e.val);
  const minV=Math.min(...vals),maxV=Math.max(...vals),range=maxV-minV||1;
  const pr=Math.max(...vals),latest=vals[vals.length-1],firstV=vals[0];
  const gained=+(latest-firstV).toFixed(1);
  const avg=+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);

  // Linear regression for trend line
  const n=entries.length;
  const xMean=(n-1)/2;
  const yMean=vals.reduce((a,b)=>a+b,0)/n;
  const num=vals.reduce((s,v,i)=>s+(i-xMean)*(v-yMean),0);
  const den=vals.reduce((s,_,i)=>s+(i-xMean)**2,0);
  const slope=den?num/den:0;
  const intercept=yMean-slope*xMean;

  const W=320,H=160,pX=34,pY=28,iW=W-pX*2,iH=H-pY*2;
  const gx=i=>pX+(i/(entries.length-1))*iW;
  const gy=v=>pY+iH-((v-minV)/range)*iH;
  const barW=Math.max(6,Math.min(22,(iW/entries.length)*0.65));

  const pts=entries.map((e,i)=>`${gx(i)},${gy(e.val)}`).join(" ");
  const pathD=entries.reduce((d,e,i)=>{const x=gx(i),y=gy(e.val);if(i===0)return `M${x},${y}`;const px=gx(i-1),py=gy(entries[i-1].val);const cx=(x+px)/2;return d+` C${cx},${py} ${cx},${y} ${x},${y}`;},""  );
  const areaD=`${pathD} L${gx(n-1)},${H-pY+2} L${gx(0)},${H-pY+2} Z`;

  const trendY0=pY+iH-((intercept-minV)/range)*iH;
  const trendY1=pY+iH-(((slope*(n-1)+intercept)-minV)/range)*iH;
  const trendUp=slope>=0;

  const getXL=e=>view==="week"?e.label:view==="month"?e.label?.split(" ")[0]:e.date?.slice(5);

  // Tooltip
  const hov=hovIdx!=null?entries[hovIdx]:null;
  const isPR=hov&&hov.val===pr;
  const isFirst=hovIdx===0;
  const isLast=hovIdx===n-1;

  // Milestone badges: PR, first, latest
  const milestones={[n-1]:"NOW"};
  if(all.length>0){const prIdx=entries.findIndex(e=>e.val===pr);if(prIdx>=0)milestones[prIdx]="PR";}

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:SP.sm}}>
        <div>
          <div style={{fontSize:13,color:C.text,fontWeight:700}}>{exName}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
            <span style={{fontSize:10,color:trendUp?C.ok:C.warn}}>{trendUp?"▲":"▼"} {Math.abs(slope).toFixed(2)} kg/session</span>
            <span style={{fontSize:9,color:C.textLow}}>trend</span>
          </div>
        </div>
        <Tabs/>
      </div>

      {/* Chart type + trend toggle */}
      <div style={{display:"flex",gap:6,marginBottom:SP.sm}}>
        {[["line","〰 Line"],["bar","▐ Bar"]].map(([t,l])=>(
          <button key={t} onClick={()=>setChartType(t)} style={{padding:"3px 9px",background:chartType===t?accent+"22":C.card,border:`1px solid ${chartType===t?accent:C.border}`,borderRadius:5,color:chartType===t?accent:C.textMid,fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>
            {l}
          </button>
        ))}
        <button onClick={()=>setShowTrend(t=>!t)} style={{padding:"3px 9px",background:showTrend?"#ffffff18":C.card,border:`1px solid ${showTrend?"#ffffff44":C.border}`,borderRadius:5,color:showTrend?C.textMid:C.textLow,fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>
          ── Trend
        </button>
      </div>

      {/* SVG Chart */}
      <div style={{overflowX:"auto",borderRadius:10,background:C.surfaceHi,border:`1px solid ${C.border}`,padding:"8px 4px 4px"}}>
        <svg ref={svgRef} width={W} height={H} style={{overflow:"visible",display:"block",cursor:"crosshair"}}
          onMouseLeave={()=>setHovIdx(null)}
          onMouseMove={e=>{
            const rect=svgRef.current?.getBoundingClientRect();
            if(!rect)return;
            const mx=e.clientX-rect.left;
            const closest=entries.reduce((best,_,i)=>{const d=Math.abs(gx(i)-mx*(W/rect.width));return d<best.d?{i,d}:best;},{i:0,d:Infinity});
            setHovIdx(closest.i);
          }}
          onTouchMove={e=>{
            const rect=svgRef.current?.getBoundingClientRect();
            if(!rect)return;
            const mx=e.touches[0].clientX-rect.left;
            const closest=entries.reduce((best,_,i)=>{const d=Math.abs(gx(i)-mx*(W/rect.width));return d<best.d?{i,d}:best;},{i:0,d:Infinity});
            setHovIdx(closest.i);
          }}
        >
          <defs>
            <linearGradient id={`ga_${exId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0.02"/>
            </linearGradient>
            <linearGradient id={`gb_${exId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0.3"/>
            </linearGradient>
            <filter id={`glow_${exId}`}>
              <feGaussianBlur stdDeviation="3" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id={`goldglow_${exId}`}>
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feColorMatrix in="b" values="1 0.8 0 0 0  0 0.7 0 0 0  0 0 0 0 0  0 0 0 3 0" result="r"/>
              <feMerge><feMergeNode in="r"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <clipPath id={`clip_${exId}`}><rect x={pX} y={pY} width={iW} height={iH+2}/></clipPath>
          </defs>

          {/* Grid lines */}
          {[0,0.25,0.5,0.75,1].map(f=>{
            const y=pY+f*iH;
            const v=(maxV-f*range).toFixed(1);
            return(
              <g key={f}>
                <line x1={pX} x2={W-pX} y1={y} y2={y} stroke={C.border} strokeWidth={f===0||f===1?"1":"0.5"} strokeDasharray={f===0||f===1?"":"3,5"}/>
                <text x={pX-5} y={y+3} fontSize="7" fill={C.textLow} textAnchor="end">{v}</text>
              </g>
            );
          })}

          {/* Avg line */}
          {(() => {
            const ay=gy(avg);
            return(
              <g>
                <line x1={pX} x2={W-pX} y1={ay} y2={ay} stroke={accent} strokeWidth="0.8" strokeDasharray="2,6" opacity="0.4"/>
                <text x={W-pX+3} y={ay+3} fontSize="7" fill={accent} opacity="0.6">avg</text>
              </g>
            );
          })()}

          {/* Trend line */}
          {showTrend&&(
            <line x1={gx(0)} y1={Math.max(pY,Math.min(H-pY,trendY0))} x2={gx(n-1)} y2={Math.max(pY,Math.min(H-pY,trendY1))}
              stroke={trendUp?"#00e676":"#ff1744"} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.7"
              clipPath={`url(#clip_${exId})`}/>
          )}

          {/* BAR chart */}
          {chartType==="bar"&&entries.map((e,i)=>{
            const x=gx(i)-barW/2;
            const barH2=((e.val-minV)/range)*iH||4;
            const y=pY+iH-barH2;
            const isPRBar=e.val===pr;
            const isHov=hovIdx===i;
            return(
              <g key={`b_${i}`}>
                <rect x={x} y={y} width={barW} height={barH2}
                  fill={isPRBar?`url(#goldglow_${exId})`:isHov?accent:`url(#gb_${exId})`}
                  rx="3"
                  filter={isPRBar?`url(#goldglow_${exId})`:"none"}
                  opacity={isHov||isPRBar?1:0.7}
                />
                {isPRBar&&<rect x={x} y={y} width={barW} height={barH2} fill="none" stroke="#ffd700" strokeWidth="1.5" rx="3" opacity="0.9"/>}
              </g>
            );
          })}

          {/* LINE chart: area + curve */}
          {chartType==="line"&&<>
            <path d={areaD} fill={`url(#ga_${exId})`} clipPath={`url(#clip_${exId})`}/>
            <path d={pathD} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
              filter={`url(#glow_${exId})`} clipPath={`url(#clip_${exId})`}/>
          </>}

          {/* Hover vertical guide */}
          {hovIdx!=null&&(
            <line x1={gx(hovIdx)} x2={gx(hovIdx)} y1={pY} y2={H-pY} stroke={accent} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>
          )}

          {/* Data points + milestone badges */}
          {entries.map((e,i)=>{
            const isPRDot=e.val===pr;
            const isHov=hovIdx===i;
            const r=isPRDot?6:isHov?5:3.5;
            const badge=milestones[i];
            return(
              <g key={`p_${i}`}>
                {isPRDot&&<circle cx={gx(i)} cy={gy(e.val)} r={r+5} fill="#ffd700" opacity="0.15" filter={`url(#goldglow_${exId})`}/>}
                <circle cx={gx(i)} cy={gy(e.val)} r={r}
                  fill={isPRDot?"#ffd700":isHov?accent:accent}
                  stroke={C.bg} strokeWidth="1.5"
                  filter={isPRDot?`url(#goldglow_${exId})`:"none"}
                  opacity={isHov||isPRDot?1:0.8}
                />
                {/* Milestone badge */}
                {badge&&!isHov&&(
                  <g>
                    <rect x={gx(i)-10} y={gy(e.val)-22} width={20} height={12} rx="3"
                      fill={isPRDot?"#ffd700":accent} opacity="0.9"/>
                    <text x={gx(i)} y={gy(e.val)-13} textAnchor="middle" fontSize="7" fill="#000" fontWeight="bold">{badge}</text>
                  </g>
                )}
                {/* X-axis labels */}
                {(i===0||i===n-1||(entries.length<=7)||i%Math.ceil(n/5)===0)&&(
                  <text x={gx(i)} y={H-pY+13} textAnchor="middle" fontSize="7.5" fill={i===n-1?accent:C.textLow}>{getXL(e)}</text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hov&&(()=>{
            const tx=gx(hovIdx);
            const ty=gy(hov.val);
            const boxW=72,boxH=36;
            const bx=Math.min(W-pX-boxW,Math.max(pX,tx-boxW/2));
            const by=ty-boxH-10<pY?ty+10:ty-boxH-10;
            return(
              <g>
                <rect x={bx} y={by} width={boxW} height={boxH} rx="6"
                  fill={C.card} stroke={isPR?"#ffd700":accent} strokeWidth="1.5" opacity="0.97"/>
                <text x={bx+boxW/2} y={by+13} textAnchor="middle" fontSize="13" fontWeight="bold"
                  fill={isPR?"#ffd700":accent}>{hov.val} kg{isPR?" ★":""}</text>
                <text x={bx+boxW/2} y={by+26} textAnchor="middle" fontSize="8" fill={C.textLow}>{hov.date?.slice(5)}</text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Stats strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginTop:SP.sm}}>
        {[
          {label:"LATEST",val:`${latest}kg`,color:accent,big:true},
          {label:"PR",val:`${pr}kg`,color:"#ffd700",big:true},
          {label:"AVG",val:`${avg}kg`,color:C.textMid,big:false},
          {label:"GAIN",val:`${gained>=0?"+":""}${gained}kg`,color:gained>=0?C.ok:C.warn,big:false},
          {label:"LOGS",val:all.length,color:C.textMid,big:false},
        ].map(s=>(
          <div key={s.label} style={{background:C.surfaceHi,border:`1px solid ${s.color}28`,borderRadius:7,padding:"6px 4px",textAlign:"center"}}>
            <div style={{fontSize:s.big?14:12,color:s.color,fontWeight:700,lineHeight:1,textShadow:s.big?`0 0 10px ${s.color}66`:"none"}}>{s.val}</div>
            <div style={{fontSize:7,color:C.textLow,marginTop:2,letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Streak / consistency mini-bar */}
      {all.length>=2&&(()=>{
        const last7=[];
        for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;last7.push(all.some(e=>e.date===ds));}
        const streak=last7.filter(Boolean).length;
        return(
          <div style={{marginTop:SP.sm,display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:9,color:C.textLow,flexShrink:0}}>Last 7d</div>
            <div style={{display:"flex",gap:3,flex:1}}>
              {last7.reverse().map((active2,i)=>(
                <div key={i} style={{flex:1,height:6,borderRadius:3,background:active2?accent:C.surfaceHi,
                  boxShadow:active2?`0 0 6px ${accent}88`:"none"}}/>
              ))}
            </div>
            <div style={{fontSize:9,color:accent,flexShrink:0,fontFamily:"monospace"}}>{streak}/7</div>
          </div>
        );
      })()}
    </div>
  );
}

function CompletionSummary({sessId,date,log,onDone,exList}){
  const sess=SESSIONS.find(s=>s.id===sessId)??SESSIONS[0];
  exList = exList ?? [];
  const weighted=exList.filter(e=>e.weighted);
  const bodyweight=exList.filter(e=>!e.weighted);
  const loggedW=weighted.filter(e=>(log[makeKey(date,sessId,e.id)]??null)!=null);
  const doneBW=bodyweight.filter(e=>(log[makeKey(date,sessId,e.id)]??null)!=null);
  const totalSets=loggedW.reduce((a,e)=>a+(typeof e.sets==="number"?e.sets:parseInt(e.sets,10)||0),0);
  const totalVol=loggedW.reduce((a,e)=>{const kg=log[makeKey(date,sessId,e.id)];const s=typeof e.sets==="number"?e.sets:parseInt(e.sets,10)||0;return a+(typeof kg==="number"?kg*s*6:0);},0);
  const comp=getCompletionStats(log,sessId,date,exList);
  return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:SP.lg,fontFamily:"Georgia,serif",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${sess.color}0e 0%,transparent 70%)`,pointerEvents:"none"}}/>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${sess.color},transparent)`}}/>
    <div style={{fontSize:52,marginBottom:SP.md,filter:`drop-shadow(0 0 16px ${sess.color})`}}>✓</div>
    <div style={{fontSize:9,color:sess.color,letterSpacing:5,marginBottom:SP.xs,fontFamily:"monospace",textShadow:`0 0 10px ${sess.color}`}}>WORKOUT COMPLETE</div>
    <div style={{fontSize:26,color:C.text,marginBottom:SP.xs}}>{sess.label}</div>
    <div style={{fontSize:11,color:C.textLow,marginBottom:SP.sm,fontFamily:"monospace"}}>{fmtDate(date)}</div>
    <div style={{fontSize:14,color:sess.color,fontWeight:700,marginBottom:SP.xl,background:sess.color+"14",border:`1px solid ${sess.color}33`,borderRadius:8,padding:"6px 16px",fontFamily:"monospace"}}>{comp.done}/{comp.total} · {comp.pct}% complete</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:SP.sm,width:"100%",maxWidth:320,marginBottom:SP.xl}}>
      <StatCard label="Exercises" value={loggedW.length+doneBW.length} color={sess.color}/>
      <StatCard label="Sets" value={totalSets} color={C.gold}/>
      <StatCard label="Volume" value={totalVol>0?`${Math.round(totalVol/1000)}k kg`:"—"} color={C.pull}/>
    </div>
    {loggedW.length>0&&<div style={{width:"100%",maxWidth:320,marginBottom:SP.xl}}>
      <SectionHeader color={C.textMid}>Weights Logged</SectionHeader>
      {loggedW.map(e=>{const kg=log[makeKey(date,sessId,e.id)];const last=getLastWeight(log,sessId,e.id,date);const isNew=last&&kg>last;return <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><div style={{fontSize:12,color:C.text}}>{e.icon} {e.name}</div><div style={{display:"flex",alignItems:"center",gap:SP.sm}}>{isNew&&<span style={{fontSize:9,color:C.ok}}>▲ PR</span>}<span style={{fontSize:13,color:sess.color}}>{kg} kg</span></div></div>;})}
    </div>}
    <Button onClick={onDone} color={sess.color} style={{width:"100%",maxWidth:320,padding:SP.md,fontSize:15}}>Done →</Button>
  </div>;
}

function ExerciseEditorView({sessId,exList,warmupList,cooldownList,onSave,onSaveWarmup,onSaveCooldown,onBack}){
  const sess = SESSIONS.find(s=>s.id===sessId) ?? SESSIONS[0];
  const [tab,setTab]=useState("main"); // "main" | "warmup" | "cooldown"
  const [rows,setRows] = useState(()=>exList.map(e=>({...e})));
  const [wuRows,setWuRows] = useState(()=>{
    const list=warmupList||[];const flat=[];
    list.forEach(x=>{
      if(typeof x==="string")flat.push({text:x});
      else if(x&&Array.isArray(x.items))x.items.forEach(it=>flat.push({text:it}));
      else if(x&&x.text)flat.push({text:x.text});
    });
    return flat;
  });
  const [cdRows,setCdRows] = useState(()=>(cooldownList||[]).map(x=>typeof x==="string"?{text:x}:{text:x.text||""}));
  const [emojiPickerIdx,setEmojiPickerIdx] = useState(null);

  const EMOJI_OPTS = ["🏋","💪","🦵","⬇","↔","🎯","🔨","🤸","🧘","⚡","📐","🔼","🦅","🛡","🍑","🦀","🌉","🧳","💨","🏃","🦘","📦","🔄","↩","🔥","⬆","🤲","✊","🦶","🦾","🏔","🪜","⛓","🧗","🥊","🤾","🦴","🌀","➰","🪢","🎢","🪂","🦿","🧱","⚓","🪝","🔽","↗"];

  function patchRow(idx,patch){setRows(rs=>rs.map((r,i)=>i===idx?{...r,...patch}:r));}
  function deleteRow(idx){setRows(rs=>rs.filter((_,i)=>i!==idx));setEmojiPickerIdx(null);}
  function moveRow(idx,dir){
    setRows(rs=>{
      const j=idx+dir; if(j<0||j>=rs.length) return rs;
      const next=rs.slice(); const [item]=next.splice(idx,1); next.splice(j,0,item);
      return next;
    });
    setEmojiPickerIdx(null);
  }
  function moveListItem(setter,idx,dir){
    setter(rs=>{
      const j=idx+dir; if(j<0||j>=rs.length) return rs;
      const next=rs.slice(); const [item]=next.splice(idx,1); next.splice(j,0,item);
      return next;
    });
  }
  function addRow(){
    const existingIds = rows.map(r=>r.id);
    const id = makeExerciseId("New Exercise", existingIds);
    setRows(rs=>[...rs,{ id, name:"New Exercise", icon:"🏋", weighted:true, sets:3, reps:"10–12", tempo:"", focus:"", warn:"" }]);
  }
  function handleSave(){
    const existingIds = [];
    const cleaned = rows
      .filter(r=>r.name && r.name.trim())
      .map(r=>{
        let id = r.id;
        if (!id || existingIds.includes(id)) id = makeExerciseId(r.name, existingIds);

        existingIds.push(id);
        const setsNum = typeof r.sets==="number" ? r.sets : (parseInt(r.sets,10) || 1);
        return { ...r, id, name:r.name.trim(), sets:setsNum, reps:(r.reps??"").toString() };
      });
    onSave(sessId, cleaned);
    onBack();
  }

  const inputStyle = {width:"100%",background:C.surfaceHi,border:`1px solid ${C.border}`,
    borderRadius:5,color:C.text,fontSize:12,padding:"6px 8px",
    fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box"};

  return (
    <div style={{paddingBottom:80}}>
      <div style={{background:`linear-gradient(180deg,${sess.color}14 0%,${sess.color}06 100%)`,borderBottom:`1px solid ${sess.color}35`,padding:"18px 16px 14px",position:"relative"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${sess.color},transparent)`,opacity:.7}}/>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:0,marginBottom:SP.sm,fontFamily:"Georgia,serif"}}>← Cancel</button>
        <button onClick={()=>{
          if(tab==="main") handleSave();
          else if(tab==="warmup"){onSaveWarmup&&onSaveWarmup(sessId,wuRows.map(r=>r.text||"").filter(Boolean));onBack();}
          else{onSaveCooldown&&onSaveCooldown(sessId,cdRows.map(r=>r.text||"").filter(Boolean));onBack();}
        }} style={{position:"absolute",top:18,right:16,background:sess.color,border:"none",borderRadius:7,color:"#fff",fontSize:12,padding:"8px 14px",cursor:"pointer",fontFamily:"Georgia,serif"}}>Save</button>
        <div style={{fontSize:9,color:sess.color,letterSpacing:3,marginBottom:3,fontFamily:"monospace"}}>EDIT WORKOUT</div>
        <div style={{fontSize:20}}>{sess.icon} {sess.label}</div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
        {[["main","Main"],["warmup","Warm-Up"],["cooldown","Cool Down"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px 4px",background:"none",
            border:"none",borderBottom:`2px solid ${tab===t?sess.color:"transparent"}`,
            color:tab===t?sess.color:C.textMid,fontSize:11,cursor:"pointer",fontFamily:"Georgia,serif"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{padding:SP.md}}>
        {/* ── MAIN WORKOUT TAB ── */}
        {tab==="main"&&<>
          {rows.length===0&&<div style={{textAlign:"center",padding:`${SP.xl}px ${SP.md}px`,color:C.textLow,fontSize:12,lineHeight:1.8}}>No exercises yet.<br/>Tap "+ Add" below.</div>}
          {rows.map((r,i)=>(
            <Card key={r.id??i} style={{padding:12,marginBottom:8}}>
              <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
                  <button onClick={()=>moveRow(i,-1)} disabled={i===0} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===0?C.textLow:C.text,fontSize:10,cursor:i===0?"default":"pointer",lineHeight:1,opacity:i===0?.4:1}}>▲</button>
                  <button onClick={()=>moveRow(i,1)} disabled={i===rows.length-1} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===rows.length-1?C.textLow:C.text,fontSize:10,cursor:i===rows.length-1?"default":"pointer",lineHeight:1,opacity:i===rows.length-1?.4:1}}>▼</button>
                </div>
                <div style={{position:"relative"}}>
                  <button onClick={()=>setEmojiPickerIdx(emojiPickerIdx===i?null:i)}
                    style={{width:38,height:38,fontSize:20,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {r.icon||"🏋"}
                  </button>
                  {emojiPickerIdx===i&&<div style={{position:"absolute",top:42,left:0,zIndex:50,background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:8,padding:6,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:3,width:180}}>
                    {EMOJI_OPTS.map(em=><button key={em} onClick={()=>{patchRow(i,{icon:em});setEmojiPickerIdx(null);}} style={{background:r.icon===em?sess.color+"22":"none",border:"none",borderRadius:4,cursor:"pointer",fontSize:16,padding:3}}>{em}</button>)}
                  </div>}
                </div>
                <input value={r.name} onChange={e=>patchRow(i,{name:e.target.value})} placeholder="Exercise name"
                  style={{...inputStyle,flex:1,fontSize:13,padding:"8px 10px",border:`1px solid ${C.borderHi}`}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                {[["SETS","sets","3"],["REPS","reps","8–12"],["TEMPO","tempo","3-1-1-0"]].map(([l,k,ph])=>(
                  <div key={k}><div style={{fontSize:8,color:C.textLow,marginBottom:3}}>{l}</div>
                    <input value={r[k]??""} onChange={e=>patchRow(i,{[k]:e.target.value})} placeholder={ph} style={inputStyle}/></div>
                ))}
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:8,color:C.textLow,marginBottom:3}}>CUE / FOCUS NOTE</div>
                <textarea value={r.focus??""} onChange={e=>patchRow(i,{focus:e.target.value})} placeholder="Technique cues…" rows={2} style={{...inputStyle,resize:"vertical",lineHeight:1.5}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:6}}>
                  {[["Weighted",true,sess.color],["Bodyweight",false,C.ok]].map(([l,w,c])=>(
                    <button key={l} onClick={()=>patchRow(i,{weighted:w})} style={{padding:"5px 10px",background:r.weighted===w?c+"22":C.surfaceHi,border:`1px solid ${r.weighted===w?c:C.border}`,borderRadius:5,color:r.weighted===w?c:C.textMid,fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif"}}>{l}</button>
                  ))}
                </div>
                <button onClick={()=>deleteRow(i)} style={{background:"none",border:`1px solid ${C.warn}40`,borderRadius:5,color:C.warn,fontSize:11,padding:"5px 10px",cursor:"pointer",fontFamily:"Georgia,serif"}}>✕ Delete</button>
              </div>
            </Card>
          ))}
          <Button onClick={addRow} variant="secondary" color={sess.color} style={{width:"100%",padding:SP.md,marginTop:4,border:`1px dashed ${sess.color}55`,textAlign:"center"}}>+ Add Exercise</Button>
        </>}

        {/* ── WARMUP TAB ── */}
        {tab==="warmup"&&<>
          <div style={{fontSize:10,color:C.textLow,marginBottom:SP.md,lineHeight:1.6}}>Edit warm-up steps. Each line is one step shown to you before the session starts.</div>
          {wuRows.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
                <button onClick={()=>moveListItem(setWuRows,i,-1)} disabled={i===0} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===0?C.textLow:C.text,fontSize:10,cursor:i===0?"default":"pointer",lineHeight:1,opacity:i===0?.4:1}}>▲</button>
                <button onClick={()=>moveListItem(setWuRows,i,1)} disabled={i===wuRows.length-1} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===wuRows.length-1?C.textLow:C.text,fontSize:10,cursor:i===wuRows.length-1?"default":"pointer",lineHeight:1,opacity:i===wuRows.length-1?.4:1}}>▼</button>
              </div>
              <input value={r.text||""} onChange={e=>setWuRows(rs=>rs.map((x,j)=>j===i?{text:e.target.value}:x))}
                placeholder="e.g. Standing leg swings × 1×15 each leg"
                style={{...inputStyle,flex:1}}/>
              <button onClick={()=>setWuRows(rs=>rs.filter((_,j)=>j!==i))} style={{background:"none",border:`1px solid ${C.warn}40`,borderRadius:5,color:C.warn,fontSize:11,padding:"5px 8px",cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          ))}
          <button onClick={()=>setWuRows(rs=>[...rs,{text:""}])} style={{width:"100%",padding:SP.md,marginTop:4,background:"none",border:`1px dashed ${sess.color}55`,borderRadius:8,color:sess.color,cursor:"pointer",fontFamily:"Georgia,serif"}}>+ Add Step</button>
        </>}

        {/* ── COOLDOWN TAB ── */}
        {tab==="cooldown"&&<>
          <div style={{fontSize:10,color:C.textLow,marginBottom:SP.md,lineHeight:1.6}}>Edit cool-down steps shown after the session completes.</div>
          {cdRows.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
                <button onClick={()=>moveListItem(setCdRows,i,-1)} disabled={i===0} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===0?C.textLow:C.text,fontSize:10,cursor:i===0?"default":"pointer",lineHeight:1,opacity:i===0?.4:1}}>▲</button>
                <button onClick={()=>moveListItem(setCdRows,i,1)} disabled={i===cdRows.length-1} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===cdRows.length-1?C.textLow:C.text,fontSize:10,cursor:i===cdRows.length-1?"default":"pointer",lineHeight:1,opacity:i===cdRows.length-1?.4:1}}>▼</button>
              </div>
              <input value={r.text||""} onChange={e=>setCdRows(rs=>rs.map((x,j)=>j===i?{text:e.target.value}:x))}
                placeholder="e.g. Doorway chest stretch — 2×30s"
                style={{...inputStyle,flex:1}}/>
              <button onClick={()=>setCdRows(rs=>rs.filter((_,j)=>j!==i))} style={{background:"none",border:`1px solid ${C.warn}40`,borderRadius:5,color:C.warn,fontSize:11,padding:"5px 8px",cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          ))}
          <button onClick={()=>setCdRows(rs=>[...rs,{text:""}])} style={{width:"100%",padding:SP.md,marginTop:4,background:"none",border:`1px dashed ${sess.color}55`,borderRadius:8,color:sess.color,cursor:"pointer",fontFamily:"Georgia,serif"}}>+ Add Step</button>
        </>}
      </div>
    </div>
  );
}

const _btn={background:"none",border:"1px solid #333",borderRadius:4,color:"#aaa",fontSize:14,width:24,height:24,cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center"};
function RestTimer(){
  const [open,setOpen]=useState(false);
  const [mins,setMins]=useState(2);
  const [secs,setSecs]=useState(0);
  const [rem,setRem]=useState(null);
  const [running,setRunning]=useState(false);
  const itv=useRef(null);
  useEffect(()=>{
    if(!running){clearInterval(itv.current);return;}
    itv.current=setInterval(()=>setRem(r=>{
      if(r<=1){setRunning(false);clearInterval(itv.current);
        try{if(navigator.vibrate)navigator.vibrate([400,100,400,100,400]);}catch(_){}
        return 0;}
      return r-1;
    }),1000);
    return()=>clearInterval(itv.current);
  },[running]);
  const total=mins*60+secs;
  const disp=rem??total;
  const mm=String(Math.floor(disp/60)).padStart(2,"0");
  const ss2=String(disp%60).padStart(2,"0");
  const pct=rem!=null?(1-(rem/(total||1)))*100:0;
  return(
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setOpen(o=>!o)} aria-label="Rest timer"
        style={{width:36,height:36,borderRadius:9,background:running?"#0a2e1a":C.surfaceHi,
          border:`1.5px solid ${running?"#00e676":C.borderHi}`,
          color:running?"#00e676":C.textMid,fontSize:20,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:running?"0 0 18px #00e67666, 0 0 6px #00e67633":"none",position:"relative",transition:"all .2s"}}>
        ⏱
        {running&&<div style={{position:"absolute",bottom:2,left:2,right:2,height:2,background:"#111",borderRadius:1}}>
          <div style={{height:"100%",width:`${pct}%`,background:"#00e676",borderRadius:1,transition:"width 1s linear"}}/>
        </div>}
      </button>
      {open&&<div style={{position:"absolute",top:44,right:0,zIndex:300,background:C.card,
        border:`1px solid ${C.borderHi}`,borderRadius:12,padding:14,width:200,
        boxShadow:"0 8px 32px #00000099"}}>
        <div style={{fontSize:9,color:C.textLow,letterSpacing:2,textAlign:"center",marginBottom:8}}>REST TIMER</div>
        <div style={{textAlign:"center",fontSize:34,fontFamily:"monospace",fontWeight:700,
          color:rem===0?"#ff1744":running?"#00e676":C.text,
          textShadow:running?"0 0 18px #00e67688":"none",marginBottom:10,letterSpacing:2}}>
          {mm}:{ss2}
        </div>
        {!running&&rem===null&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[["MIN",mins,v=>setMins(Math.max(0,Math.min(59,v)))],["SEC",secs,v=>setSecs(Math.max(0,Math.min(50,Math.round(v/10)*10)))]].map(([l,v,fn])=>(
              <div key={l}>
                <div style={{fontSize:8,color:C.textLow,marginBottom:4,textAlign:"center"}}>{l}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                  <button onClick={()=>fn(v-(l==="SEC"?10:1))} style={_btn}>−</button>
                  <span style={{fontSize:16,fontFamily:"monospace",fontWeight:700,color:C.text,minWidth:24,textAlign:"center"}}>{String(v).padStart(2,"0")}</span>
                  <button onClick={()=>fn(v+(l==="SEC"?10:1))} style={_btn}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:5,marginBottom:10,justifyContent:"center",flexWrap:"wrap"}}>
            {[[1,0],[1,30],[2,0],[3,0]].map(([m2,s2])=>(
              <button key={`${m2}:${s2}`} onClick={()=>{setMins(m2);setSecs(s2);}}
                style={{fontSize:9,padding:"4px 8px",background:C.surfaceHi,border:`1px solid ${C.border}`,
                  borderRadius:5,color:C.textMid,cursor:"pointer",fontFamily:"monospace"}}>
                {m2}:{String(s2).padStart(2,"0")}
              </button>
            ))}
          </div>
          <button onClick={()=>{setRem(total);setRunning(true);}}
            style={{width:"100%",background:"#00e676",border:"none",borderRadius:7,
              color:"#000",fontSize:12,fontWeight:700,padding:"8px 0",cursor:"pointer",
              fontFamily:"monospace",boxShadow:"0 0 16px #00e67644"}}>
            START
          </button>
        </>}
        {(running||(!running&&rem!==null))&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <button onClick={()=>setRunning(r=>!r)}
            style={{background:"#1e8449",border:"none",borderRadius:7,color:"#fff",
              fontSize:11,padding:"8px 0",cursor:"pointer",fontFamily:"monospace"}}>
            {running?"PAUSE":"RESUME"}
          </button>
          <button onClick={()=>{setRunning(false);setRem(null);}}
            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,
              color:C.textMid,fontSize:11,padding:"8px 0",cursor:"pointer",fontFamily:"monospace"}}>
            RESET
          </button>
        </div>}
        {rem===0&&<div style={{textAlign:"center",marginTop:8,fontSize:11,color:"#ff1744",
          fontFamily:"monospace"}}>REST COMPLETE ✓</div>}
      </div>}
    </div>
  );
}

function SessionView({sessId,date,log,onLog,onBack,onComplete,exList,warmupList,cooldownList,onEdit}){
  const sess=SESSIONS.find(s=>s.id===sessId)??SESSIONS[0];
  exList = exList ?? [];
  const wu=warmupList??WARMUPS[sessId]??[];
  const cd=cooldownList??COOLDOWNS[sessId]??[];
  const isComplete=!!log[doneKey(date,sessId)];
  const comp=getCompletionStats(log,sessId,date,exList);
  return <div style={{paddingBottom:80}}>
    <div style={{background:`linear-gradient(180deg,${sess.color}14 0%,${sess.color}06 100%)`,borderBottom:`1px solid ${sess.color}35`,padding:"18px 16px 14px",position:"relative"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${sess.color},transparent)`,opacity:.7}}/>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:0,marginBottom:SP.sm,fontFamily:"Georgia,serif"}}>← Back</button>
      {onEdit && <div style={{position:"absolute",top:16,right:16,display:"flex",gap:8,alignItems:"center"}}>
        <RestTimer/>
        <button onClick={onEdit} aria-label="Edit workout"
          style={{background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:7,color:sess.color,
            fontSize:11,padding:"7px 12px",cursor:"pointer",fontFamily:"Georgia,serif"}}>
          ✎ Edit
        </button>
      </div>}
      <div style={{fontSize:9,color:sess.color,letterSpacing:3,marginBottom:3,fontFamily:"monospace"}}>{fmtDate(date)}</div>
      <div style={{fontSize:22}}>{sess.icon} {sess.label}</div>
      <div style={{fontSize:11,color:C.textMid,marginTop:2}}>{sess.sub}</div>
      <div style={{fontSize:10,color:C.textLow,marginTop:2}}>📍 {sess.loc}</div>
      {sess.note&&<div style={{marginTop:8,fontSize:11,color:C.textMid,lineHeight:1.6,background:sess.color+"0a",border:`1px solid ${sess.color}20`,borderRadius:6,padding:"8px 10px"}}>{sess.note}</div>}
      <div style={{marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5}}>
          <span style={{color:C.textMid,fontFamily:"monospace",fontSize:10}}>{comp.done}/{comp.total} exercises</span>
          <span style={{color:sess.color,fontWeight:700,fontFamily:"monospace",textShadow:`0 0 8px ${sess.color}`}}>{comp.pct}%</span>
        </div>
        <div style={{height:7,background:C.surfaceHi,borderRadius:4,overflow:"hidden",border:`1px solid ${sess.color}22`,position:"relative"}}>
          <div style={{height:"100%",width:`${comp.pct}%`,background:`linear-gradient(90deg,${sess.color}77,${sess.color})`,borderRadius:4,transition:"width 0.45s cubic-bezier(.22,1,.36,1)",boxShadow:`0 0 10px ${sess.color}99`}}/>
          {comp.pct>5&&<div style={{position:"absolute",top:0,left:0,height:"100%",width:`${comp.pct}%`,
            background:"linear-gradient(90deg,transparent 10%,rgba(255,255,255,.2) 50%,transparent 90%)",
            backgroundSize:"200% 100%",animation:"_inShimmer 1.5s linear 1",pointerEvents:"none"}}/>}
        </div>
        <div style={{display:"flex",gap:3,marginTop:4}}>
          {Array.from({length:comp.total},(_,i)=>(
            <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<comp.done?sess.color:C.surfaceHi,boxShadow:i<comp.done?`0 0 4px ${sess.color}`:void 0,transition:"background .3s"}}/>
          ))}
        </div>
      </div>
      {isComplete&&<div style={{marginTop:SP.sm,display:"inline-flex",alignItems:"center",gap:5,
        background:C.ok+"22",border:`1px solid ${C.ok}55`,borderRadius:5,padding:"4px 12px",
        fontSize:10,color:C.ok,boxShadow:`0 0 12px ${C.ok}44`,
        animation:"_inPrBadge .45s cubic-bezier(.22,1.8,.4,1) both"}}>
        <span style={{animation:"_inTickIn .4s cubic-bezier(.22,1.8,.4,1) both"}}>✓</span>
        Session complete
      </div>}
    </div>
    <div style={{padding:SP.md}}>
      <Expand label="🟨 Warm-Up" accent={sess.color}>
        {wu.map((ph,i)=>typeof ph==="string"
          ? <div key={i} style={{fontSize:11,color:C.textMid,padding:"2px 0 2px 10px",lineHeight:1.5}}>· {ph}</div>
          : <div key={ph.name??i} style={{marginBottom:10}}><div style={{fontSize:9,color:sess.color,letterSpacing:2,marginBottom:5,fontFamily:"monospace"}}>{ph.name} — {ph.time}</div>{(ph.items??[]).map(it=><div key={it} style={{fontSize:11,color:C.textMid,padding:"1px 0 1px 10px",lineHeight:1.5}}>· {it}</div>)}</div>
        )}
      </Expand>
      <Divider/>
      <SectionHeader color={sess.color}>Exercises <span style={{color:C.textLow}}>({comp.done}/{comp.total})</span></SectionHeader>
      {exList.map(ex=><ExRow key={ex.id} ex={ex} accent={sess.color} logKey={makeKey(date,sessId,ex.id)} logVal={log[makeKey(date,sessId,ex.id)]??null} onLog={onLog} lastWeight={ex.weighted?getLastWeight(log,sessId,ex.id,date):undefined}/>)}
      <Divider/>
      <Expand label="🟥 Cool Down" accent={sess.color}>
        {cd.map(c=><div key={c} style={{fontSize:11,color:C.textMid,padding:"2px 0 2px 10px"}}>· {c}</div>)}
      </Expand>
      <Button onClick={()=>{onLog(doneKey(date,sessId),true);onComplete();}} color={isComplete?undefined:sess.color} variant={isComplete?"secondary":"primary"} style={{marginTop:SP.md,width:"100%",padding:SP.md,fontSize:15,border:isComplete?`2px solid ${C.ok}`:undefined,color:isComplete?C.ok:undefined}}>
        {isComplete?"✓ Completed":"Mark Session Complete"}
      </Button>
    </div>
  </div>;
}

function HistoryView({log,onOpen,onBack,exercises,onDeleteSession}){
  const [confirmDel,setConfirmDel]=useState(null); // {date,sessId}
  const [visible,setVisible]=useState(50); // render in pages so huge histories (1000+) don't all mount at once
  // Parse done__ keys using lastIndexOf for robustness — memoized so it only recomputes when the log changes
  const completed=useMemo(()=>Object.keys(log??{}).filter(k=>k.startsWith("done__")).map(k=>{
    const rest=k.slice(6); const sep=rest.lastIndexOf("__"); if(sep<0)return null;
    return{date:rest.slice(0,sep),sessId:rest.slice(sep+2)};
  }).filter(r=>r&&isValidDate(r.date)&&r.sessId).sort((a,b)=>b.date.localeCompare(a.date)),[log]);
  const shown=completed.slice(0,visible);

  return <div style={{paddingBottom:60}}>
    <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.border}`,position:"relative"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:0,marginBottom:SP.sm,fontFamily:"Georgia,serif"}}>← Back</button>
      <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:3,fontFamily:"monospace"}}>WORKOUT HISTORY</div>
      <div style={{fontSize:22}}>All Sessions</div>
      <div style={{fontSize:11,color:C.textLow,marginTop:3}}>{completed.length} session{completed.length!==1?"s":""}</div>
    </div>
    <div style={{padding:SP.md}}>
      {completed.length===0&&<div style={{textAlign:"center",padding:`${SP.xl}px ${SP.md}px`}}><div style={{fontSize:32,marginBottom:SP.md}}>💪</div><div style={{fontSize:14,color:C.textMid,marginBottom:SP.sm}}>No sessions logged yet</div><div style={{fontSize:12,color:C.textLow,lineHeight:1.8}}>Start your first session<br/>to begin tracking progress.</div></div>}
      {shown.map(s=>{
        const m=SESSIONS.find(x=>x.id===s.sessId)??{icon:"?",label:s.sessId,color:C.textMid};
        const comp=getCompletionStats(log,s.sessId,s.date,exercises?.[s.sessId]);
        const key=`${s.date}__${s.sessId}`;
        const isConfirming=confirmDel&&confirmDel.date===s.date&&confirmDel.sessId===s.sessId;
        return <div key={key} style={{background:C.card,border:`1px solid ${isConfirming?C.warn:C.border}`,borderRadius:9,padding:"12px 14px",marginBottom:SP.sm}}>
          <div style={{display:"grid",gridTemplateColumns:"44px 1fr auto",gap:SP.sm,alignItems:"center",cursor:"pointer"}} onClick={()=>!isConfirming&&onOpen(s.sessId,s.date)}>
            <IconBox color={m.color} size={20}/>
            <div>
              <div style={{fontSize:13,color:C.text}}>{m.label}</div>
              <div style={{fontSize:10,color:C.textLow,marginTop:2}}>{fmtDate(s.date)} · {comp.done}/{comp.total} exercises · {comp.pct}%</div>
            </div>
            {!isConfirming
              ? <button onClick={e=>{e.stopPropagation();setConfirmDel({date:s.date,sessId:s.sessId});}}
                  style={{background:"none",border:`1px solid ${C.warn}30`,borderRadius:6,color:C.warn,fontSize:11,padding:"5px 9px",cursor:"pointer",fontFamily:"Georgia,serif"}}>🗑</button>
              : <div style={{fontSize:18,color:C.textLow}}>›</div>
            }
          </div>
          {isConfirming&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.warn}25`,display:"flex",gap:8,alignItems:"center"}}>
            <div style={{flex:1,fontSize:11,color:C.warn}}>Delete this session?</div>
            <button onClick={()=>{onDeleteSession(s.date,s.sessId);setConfirmDel(null);}}
              style={{background:C.warn,border:"none",borderRadius:6,color:"#fff",fontSize:11,padding:"6px 12px",cursor:"pointer",fontFamily:"Georgia,serif"}}>Delete</button>
            <button onClick={()=>setConfirmDel(null)}
              style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.textMid,fontSize:11,padding:"6px 10px",cursor:"pointer",fontFamily:"Georgia,serif"}}>Cancel</button>
          </div>}
        </div>;
      })}
      {visible<completed.length&&<button onClick={()=>setVisible(v=>v+50)}
        style={{width:"100%",padding:"11px",marginTop:4,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,
          color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>
        Load more ({completed.length-visible} remaining)
      </button>}
    </div>
  </div>;
}

function ProgressView({log,onBack,exercises}){
  const [selSess,setSelSess]=useState("push");
  const [selEx,setSelEx]=useState(null);
  const meta=SESSIONS.find(s=>s.id===selSess)??SESSIONS[0];
  const exList=(exercises?.[selSess]??[]).filter(e=>e.weighted);
  useEffect(()=>{setSelEx(exList[0]?.id??null);},[selSess]);
  const hasData=eid=>Object.keys(log??{}).some(k=>{const parsed=parseExKey(k);return parsed&&parsed.sessId===selSess&&parsed.exId===eid&&typeof log[k]==="number"&&!isNaN(log[k]);});
  return <div style={{paddingBottom:60}}>
    <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.border}`}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:0,marginBottom:SP.sm,fontFamily:"Georgia,serif"}}>← Back</button>
      <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:3,fontFamily:"monospace"}}>PROGRESSION</div>
      <div style={{fontSize:22}}>Weight Tracker</div>
      <div style={{fontSize:10,color:C.textLow,marginTop:3}}>Tap exercise · All / Week / Month</div>
    </div>
    <div style={{padding:SP.md}}>
      <div style={{display:"flex",gap:6,marginBottom:SP.md,flexWrap:"wrap"}}>{["push","pull","legs"].map(s=>{const m=SESSIONS.find(x=>x.id===s)??{icon:"?",label:s,color:C.textMid};return <button key={s} onClick={()=>setSelSess(s)} style={{padding:"7px 14px",background:selSess===s?m.color+"22":C.card,border:`1px solid ${selSess===s?m.color:C.border}`,borderRadius:6,color:selSess===s?m.color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",gap:6}}><IconBox color={m.color} size={20}/> {m.label.split(" ")[0]}</button>;})}</div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:SP.md}}>{exList.map(ex=><button key={ex.id} onClick={()=>setSelEx(ex.id)} style={{padding:"5px 10px",background:selEx===ex.id?meta.color+"22":C.card,border:`1px solid ${selEx===ex.id?meta.color:C.border}`,borderRadius:5,color:selEx===ex.id?meta.color:C.textMid,fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif",position:"relative"}}>{ex.name.split(" ").slice(0,2).join(" ")}{hasData(ex.id)&&<span style={{position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:C.ok}}/>}</button>)}</div>
      {selEx&&<Card style={{padding:SP.md,marginBottom:SP.md}}><Graph exId={selEx} sessId={selSess} exName={exList.find(e=>e.id===selEx)?.name??selEx} accent={meta.color} log={log}/></Card>}
      <Divider/>
      <SectionHeader color={meta.color}>All {meta.label} — Weighted</SectionHeader>
      {exList.map(ex=>{const vals=getAllWeights(log,selSess,ex.id);const latest=vals.length?vals[vals.length-1]:null;const pr=vals.length?Math.max(...vals):null;return <div key={ex.id} onClick={()=>setSelEx(ex.id)} style={{background:selEx===ex.id?meta.color+"0d":C.surfaceHi,border:`1px solid ${selEx===ex.id?meta.color+"40":C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:6,display:"grid",gridTemplateColumns:"1fr 62px 62px",gap:SP.sm,alignItems:"center",cursor:"pointer"}}><div><div style={{fontSize:12,color:C.text}}>{ex.icon} {ex.name}</div><div style={{fontSize:9,color:C.textLow,marginTop:1}}>{vals.length} session{vals.length!==1?"s":""}</div></div><div style={{textAlign:"center"}}><div style={{fontSize:8,color:C.textLow}}>LATEST</div><div style={{fontSize:14,color:meta.color}}>{latest!=null?`${latest} kg`:"—"}</div></div><div style={{textAlign:"center"}}><div style={{fontSize:8,color:C.textLow}}>PR</div><div style={{fontSize:14,color:C.gold}}>{pr!=null?`${pr} kg`:"—"}</div></div></div>;})}
    </div>
  </div>;
}

function StartPicker({onStart,onStartMobility,onBack,themeMode}){
  const [sessId,setSessId]=useState("push");
  const [mobilityPlanId,setMobilityPlanId]=useState(MOBILITY[0].id);
  const [dateVal,setDateVal]=useState(todayStr());
  const isMobility = sessId==="mobility";
  const chosen=SESSIONS.find(s=>s.id===sessId);
  // Literal hex (not a CSS var) so it can still be alpha-suffixed (e.g. MOBILITY_TEXT+"18")
  // the way the other session colors are — white reads on dark, black reads on light.
  const MOBILITY_TEXT = themeMode==="light" ? "#000000" : "#ffffff";
  const accent = isMobility ? MOBILITY_TEXT : (chosen?.color ?? C.gold);

  const yesterday=(()=>{const d=new Date(todayStr()+"T00:00:00");d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
  const dayBefore=(()=>{const d=new Date(todayStr()+"T00:00:00");d.setDate(d.getDate()-2);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
  const quickDates=[["Today",todayStr()],["Yesterday",yesterday],[fmtDate(dayBefore).split(" ").slice(0,2).join(" "),dayBefore]];

  return <div style={{paddingBottom:60}}>
    <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.border}`}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:0,marginBottom:SP.sm,fontFamily:"Georgia,serif"}}>← Back</button>
      <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:3,fontFamily:"monospace"}}>NEW SESSION</div>
      <div style={{fontSize:22}}>Log a Workout</div>
    </div>
    <div style={{padding:"18px 16px"}}>
      <SectionHeader>Choose Session</SectionHeader>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:SP.lg}}>
        {SESSIONS.map(s=><button key={s.id} onClick={()=>setSessId(s.id)} style={{background:sessId===s.id?s.color+"18":C.card,border:`2px solid ${sessId===s.id?s.color:C.border}`,borderRadius:9,padding:"13px 16px",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",gap:12}}><IconBox color={s.color} size={20}/><div style={{flex:1}}><div style={{fontSize:14,color:sessId===s.id?s.color:C.text}}>{s.label}</div><div style={{fontSize:10,color:C.textLow,marginTop:1}}>{s.sub} · 📍 {s.loc}</div></div>{sessId===s.id&&<span style={{color:s.color,fontSize:16}}>✓</span>}</button>)}
        <button onClick={()=>setSessId("mobility")} style={{background:isMobility?MOBILITY_TEXT+"18":C.card,border:`2px solid ${isMobility?MOBILITY_TEXT:C.border}`,borderRadius:9,padding:"13px 16px",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",display:"flex",alignItems:"center",gap:12}}>
          <IconBox color={MOBILITY_TEXT} size={20}/>
          <div style={{flex:1}}><div style={{fontSize:14,color:isMobility?MOBILITY_TEXT:C.text}}>Mobility</div><div style={{fontSize:10,color:C.textLow,marginTop:1}}>Rest day stretch & activation routines</div></div>
          {isMobility&&<span style={{color:MOBILITY_TEXT,fontSize:16}}>✓</span>}
        </button>
      </div>

      {isMobility && <>
        <SectionHeader color={MOBILITY_TEXT}>Choose Rest Day</SectionHeader>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:SP.lg}}>
          {MOBILITY.map(m=>(
            <button key={m.id} onClick={()=>setMobilityPlanId(m.id)}
              style={{background:mobilityPlanId===m.id?MOBILITY_TEXT+"18":C.card,border:`2px solid ${mobilityPlanId===m.id?MOBILITY_TEXT:C.border}`,
                borderRadius:9,padding:"11px 14px",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",
                display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{fontSize:12,color:mobilityPlanId===m.id?MOBILITY_TEXT:C.text}}>After {m.after}, Before {m.before}</div>
              {mobilityPlanId===m.id&&<span style={{color:MOBILITY_TEXT,fontSize:14,flexShrink:0}}>✓</span>}
            </button>
          ))}
        </div>
      </>}

      <SectionHeader>Date</SectionHeader>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        {quickDates.map(([lbl,val])=>(
          <button key={lbl} onClick={()=>setDateVal(val)}
            style={{flex:1,padding:"9px 4px",background:dateVal===val?accent+"18":C.card,
              border:`1.5px solid ${dateVal===val?accent:C.border}`,borderRadius:8,
              color:dateVal===val?accent:C.textMid,fontSize:11,cursor:"pointer",
              fontFamily:"Georgia,serif",fontWeight:dateVal===val?700:400}}>{lbl}</button>
        ))}
      </div>
      <div style={{position:"relative",marginBottom:SP.lg}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:accent,pointerEvents:"none"}}>📅</span>
        <input type="date" value={dateVal} onChange={e=>setDateVal(e.target.value)} max={todayStr()}
          style={{width:"100%",background:C.card,border:`1.5px solid ${C.borderHi}`,borderRadius:9,color:C.text,fontSize:14,
            padding:"12px 14px 12px 38px",fontFamily:"Georgia,serif",boxSizing:"border-box",outline:"none",colorScheme:"dark"}}/>
      </div>
      <div style={{fontSize:10,color:C.textLow,marginBottom:SP.lg,textAlign:"center"}}>{fmtDate(dateVal)}</div>

      {isMobility
        ? <Button onClick={()=>onStartMobility(mobilityPlanId,dateVal)} color={MOBILITY_TEXT} style={{width:"100%",padding:SP.md,fontSize:15}}>Open Mobility →</Button>
        : <Button onClick={()=>onStart(sessId,dateVal)} color={chosen.color} style={{width:"100%",padding:SP.md,fontSize:15}}>Open {chosen.label} →</Button>}
    </div>
  </div>;
}

function IconBox({color,size=28}){
  return <div style={{width:size,height:size,borderRadius:8,background:`${color}14`,
    border:`1.5px solid ${color}`,boxShadow:`0 0 8px ${color}55`,flexShrink:0}}/>;
}

function MobilityView({log,onLog,customMobility,onSaveMobility,initialDate,initialPlanId,onBack,themeMode}){
  const [tabId,setTabId]=useState(initialPlanId&&MOBILITY.some(m=>m.id===initialPlanId)?initialPlanId:MOBILITY[0].id);
  const [date,setDate]=useState(initialDate||todayStr());
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(null);
  const plan=MOBILITY.find(m=>m.id===tabId)??MOBILITY[0];
  const items = (customMobility?.[plan.id]?.length ? customMobility[plan.id] : plan.items);
  // Literal hex (not a CSS var) so it can be alpha-suffixed like ${W}66 below —
  // white reads against the dark theme, black reads against the light theme.
  const W=themeMode==="light" ? "#000000" : "#ffffff";
  const completedToday = !!log?.[doneMobilityKey(date,plan.id)];
  const isToday = date===todayStr();

  function startEdit(){ setDraft(items.slice()); setEditing(true); }
  function cancelEdit(){ setEditing(false); setDraft(null); }
  function saveEdit(){
    const cleaned=(draft??[]).map(t=>t.trim()).filter(Boolean);
    onSaveMobility(plan.id, cleaned.length?cleaned:plan.items);
    setEditing(false); setDraft(null);
  }
  function updateDraftItem(i,val){ setDraft(d=>d.map((t,idx)=>idx===i?val:t)); }
  function removeDraftItem(i){ setDraft(d=>d.filter((_,idx)=>idx!==i)); }
  function addDraftItem(){ setDraft(d=>[...d,""]); }
  function moveDraftItem(i,dir){ setDraft(d=>{ const j=i+dir; if(j<0||j>=d.length) return d; const next=d.slice(); const [item]=next.splice(i,1); next.splice(j,0,item); return next; }); }

  function selectTab(id){ setTabId(id); setEditing(false); setDraft(null); }
  function toggleComplete(){ onLog(doneMobilityKey(date,plan.id), completedToday?null:true); }

  return <div style={{paddingBottom:60}}>
    <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${C.border}`}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:0,marginBottom:SP.sm,fontFamily:"Georgia,serif"}}>← Back</button>
      <div style={{fontSize:9,color:W,letterSpacing:3,marginBottom:3,fontFamily:"monospace",textShadow:`0 0 8px ${W}66`}}>REST DAY</div>
      <div style={{fontSize:22,color:W,textShadow:`0 0 12px ${W}55`,display:"flex",alignItems:"center",gap:10}}>
        <IconBox color={W} size={20}/> Mobility
      </div>
    </div>
    <div style={{padding:"18px 16px"}}>
      <SectionHeader color={W}>Date</SectionHeader>
      <div style={{display:"flex",gap:7,marginBottom:SP.lg}}>
        {[["Today",todayStr()],["Yesterday",(()=>{const d=new Date(todayStr()+"T00:00:00");d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})()]].map(([lbl,val])=>(
          <button key={lbl} onClick={()=>setDate(val)} style={{flex:1,padding:"9px 0",background:date===val?W+"18":C.card,border:`1.5px solid ${date===val?W:C.border}`,borderRadius:8,color:date===val?W:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:date===val?700:400}}>{lbl}</button>
        ))}
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} max={todayStr()}
          style={{flex:1,background:C.card,border:`1.5px solid ${C.borderHi}`,borderRadius:8,color:C.text,fontSize:12,padding:"9px 8px",fontFamily:"Georgia,serif",outline:"none",colorScheme:"dark",textAlign:"center"}}/>
      </div>
      <SectionHeader color={W}>Choose Rest Day</SectionHeader>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:SP.lg}}>
        {MOBILITY.map(m=>{
          const done = !!log?.[doneMobilityKey(date,m.id)];
          return (
            <button key={m.id} onClick={()=>selectTab(m.id)}
              style={{background:tabId===m.id?W+"18":C.card,border:`2px solid ${tabId===m.id?W:C.border}`,
                borderRadius:9,padding:"12px 16px",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",
                display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{fontSize:13,color:tabId===m.id?W:C.text,fontWeight:tabId===m.id?700:400}}>After {m.after}, Before {m.before}</div>
              {done&&<span style={{color:W,fontSize:14,flexShrink:0}}>✓</span>}
            </button>
          );
        })}
      </div>
      <Card style={{padding:SP.md,boxShadow:`0 0 16px ${W}1c`,border:`1px solid ${W}33`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
          <div style={{fontSize:9,color:W,letterSpacing:2,fontFamily:"monospace",textTransform:"uppercase"}}>
            After {plan.after}, Before {plan.before}
          </div>
          {!editing&&<button onClick={startEdit} style={{background:"none",border:`1px solid ${W}44`,borderRadius:6,color:W,fontSize:10,padding:"4px 9px",cursor:"pointer",fontFamily:"Georgia,serif",flexShrink:0}}>✎ Edit</button>}
        </div>
        <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,marginBottom:14}}>{plan.focus}</div>

        {!editing && <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:16}}>
          {items.map((it,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:20,height:20,borderRadius:"50%",border:`1px solid ${W}55`,color:W,
                fontSize:10,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
              <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>{it}</div>
            </div>
          ))}
        </div>}

        {editing && <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {draft.map((t,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
                <button onClick={()=>moveDraftItem(i,-1)} disabled={i===0} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===0?C.textLow:C.text,fontSize:10,cursor:i===0?"default":"pointer",lineHeight:1,opacity:i===0?.4:1}}>▲</button>
                <button onClick={()=>moveDraftItem(i,1)} disabled={i===draft.length-1} style={{width:22,height:18,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:4,color:i===draft.length-1?C.textLow:C.text,fontSize:10,cursor:i===draft.length-1?"default":"pointer",lineHeight:1,opacity:i===draft.length-1?.4:1}}>▼</button>
              </div>
              <input value={t} onChange={e=>updateDraftItem(i,e.target.value)}
                style={{flex:1,background:C.surfaceHi,border:`1px solid ${C.borderHi}`,borderRadius:7,color:C.text,fontSize:12,
                  padding:"9px 10px",fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box"}}/>
              <button onClick={()=>removeDraftItem(i)} style={{background:"none",border:`1px solid ${C.warn}44`,borderRadius:6,color:C.warn,fontSize:13,width:30,height:30,cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          ))}
          <button onClick={addDraftItem} style={{background:"none",border:`1px dashed ${W}55`,borderRadius:7,color:W,fontSize:12,padding:"9px 0",cursor:"pointer",fontFamily:"Georgia,serif"}}>+ Add Step</button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
            <button onClick={cancelEdit} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textMid,fontSize:12,padding:"10px 0",cursor:"pointer",fontFamily:"Georgia,serif"}}>Cancel</button>
            <button onClick={saveEdit} style={{background:W+"18",border:`1px solid ${W}`,borderRadius:7,color:W,fontSize:12,padding:"10px 0",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:700}}>Save</button>
          </div>
        </div>}

        {!editing && <button onClick={toggleComplete}
          style={{width:"100%",background:completedToday?W:`linear-gradient(135deg,${W}22,${W}11)`,
            border:`1.5px solid ${W}`,borderRadius:10,color:completedToday?"#000":W,fontSize:14,fontWeight:700,
            padding:SP.md,cursor:"pointer",fontFamily:"Georgia,serif",
            boxShadow:`0 0 20px ${W}33`}}>
          {completedToday?`✓ Marked Complete — ${isToday?"Today":fmtDate(date)}`:`Mark Complete — ${isToday?"Today":fmtDate(date)}`}
        </button>}
        {!editing && <div style={{fontSize:9,color:C.textLow,textAlign:"center",marginTop:8}}>Completed mobility days show up in your Consistency heatmap only.</div>}
      </Card>
    </div>
  </div>;
}

export default function App(){
  const [store,setStore]=useState(()=>lsLoad());
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [view,setView]=useState("home");
  const [active,setActive]=useState(null);
  const [mobilityActive,setMobilityActive]=useState(null);
  const [prevView,setPrevView]=useState("home");
  const [importMsg,setImportMsg]=useState("");
  const [confirmClear,setConfirmClear]=useState(false);
  const [showSplash,setShowSplash]=useState(true);
  const [themeMode,setThemeMode]=useState(()=>{
    try{ return localStorage.getItem(THEME_STORAGE_KEY)==="light" ? "light" : "dark"; }catch(_){ return "dark"; }
  });
  const fileInputRef=useRef(null);

  function toggleTheme(){
    setThemeMode(m=>{
      const next = m==="light" ? "dark" : "light";
      try{ localStorage.setItem(THEME_STORAGE_KEY, next); }catch(_){}
      return next;
    });
  }

  useDebouncedEffect(()=>{
    setSaving(true);setSaved(false);
    lsSave(store);
    setSaving(false);setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  },[store],800);

  const onLog=useCallback((key,val)=>{
    setStore(s=>{const lg=(s&&typeof s.log==="object"&&!Array.isArray(s.log))?s.log:{};const next={...s,log:{...lg}};if(val===null||val===undefined)delete next.log[key];else next.log[key]=val;return next;});
  },[]);

  function openSession(sid,date,from="home"){setActive({sessId:sid,date});setPrevView(from);setView("session");}
  function openMobility(planId,date,from="home"){setMobilityActive({planId,date});setPrevView(from);setView("mobility");}
  function goBack(){setView(prevView==="history"?"history":"home");}

  function deleteSession(date,sessId){
    setStore(s=>{
      const lg={...s.log};
      // Remove the done__ marker
      delete lg[`done__${date}__${sessId}`];
      // Remove all exercise entries for this session/date
      Object.keys(lg).forEach(k=>{
        const parsed=parseExKey(k);
        if(parsed&&parsed.date===date&&parsed.sessId===sessId) delete lg[k];
      });
      return{...s,log:lg};
    });
  }

  function openExerciseEditor(sid){ setActive(a=>({sessId:sid,date:a?.date??todayStr()})); setView("editExercises"); }
  function saveExerciseList(sid,newList){
    setStore(s=>{
      const ce=(s&&typeof s.customExercises==="object"&&!Array.isArray(s.customExercises))?s.customExercises:{};
      return { ...s, customExercises:{ ...ce, [sid]:newList } };
    });
  }
  function saveWarmupList(sid,newList){
    setStore(s=>{
      const cw=(s&&typeof s.customWarmups==="object"&&!Array.isArray(s.customWarmups))?s.customWarmups:{};
      return { ...s, customWarmups:{ ...cw, [sid]:newList } };
    });
  }
  function saveCooldownList(sid,newList){
    setStore(s=>{
      const cc=(s&&typeof s.customCooldowns==="object"&&!Array.isArray(s.customCooldowns))?s.customCooldowns:{};
      return { ...s, customCooldowns:{ ...cc, [sid]:newList } };
    });
  }
  function saveMobilityList(planId,newList){
    setStore(s=>{
      const cm=(s&&typeof s.customMobility==="object"&&!Array.isArray(s.customMobility))?s.customMobility:{};
      return { ...s, customMobility:{ ...cm, [planId]:newList } };
    });
  }
  const resolvedExercises = useMemo(()=>resolveAllExercises(store.customExercises), [store.customExercises]);

  function clearWorkoutData(){
    setStore(s=>({...s,log:{}}));
    setConfirmClear(false);
    setImportMsg("All workout entries cleared.");
    setTimeout(()=>setImportMsg(""),3000);
  }

  function loadTestData(){
    setStore(s=>({
      ...s,
      log:{...s.log,...TEST_STORE.log},
      customExercises:{...s.customExercises,...TEST_STORE.customExercises},
    }));
    setImportMsg(`✓ Loaded 30-day test run — 16 sessions, push/pull/legs/sprint cycle with deload week 3.`);
    setTimeout(()=>setImportMsg(""),5000);
  }

  function exportBackup(){
    try{
      const blob=new Blob([JSON.stringify(store)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`jayanth-workout-backup-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }catch(_){}
  }

  function importBackup(e){
    const file=e.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const parsed=JSON.parse(ev.target.result);
        const incomingLog=(parsed&&typeof parsed.log==="object"&&!Array.isArray(parsed.log))?parsed.log:null;
        const incomingCE=(parsed&&typeof parsed.customExercises==="object"&&!Array.isArray(parsed.customExercises))?parsed.customExercises:null;
        if(!incomingLog){ setImportMsg("Couldn't read that file — not a valid backup."); return; }
        setStore(s=>{
          const currentLog=(s&&typeof s.log==="object"&&!Array.isArray(s.log))?s.log:{};
          const currentCE=(s&&typeof s.customExercises==="object"&&!Array.isArray(s.customExercises))?s.customExercises:{};
          // Merge — never wipes existing entries, incoming fills gaps / updates matching keys
          return { ...s, log:{ ...currentLog, ...incomingLog }, customExercises:{ ...currentCE, ...(incomingCE??{}) } };
        });
        setImportMsg(`Imported ${Object.keys(incomingLog).length} entries — merged with existing data.`);
      }catch(_){ setImportMsg("Couldn't read that file — not valid JSON."); }
      setTimeout(()=>setImportMsg(""),4000);
    };
    reader.readAsText(file);
    e.target.value="";
  }

  const totalDone=useMemo(()=>Object.keys(store.log??{}).filter(k=>k.startsWith("done__")).length,[store.log]);
  const prs=useMemo(()=>{
    const list=[];
    Object.keys(resolvedExercises).forEach(sid=>{(resolvedExercises[sid]??[]).filter(e=>e.weighted).forEach(ex=>{const vals=getAllWeights(store.log,sid,ex.id);if(vals.length)list.push({name:ex.name,icon:ex.icon,kg:Math.max(...vals),color:SESSIONS.find(s=>s.id===sid)?.color??C.gold});});});
    list.sort((a,b)=>b.kg-a.kg);
    return list;
  },[store.log,resolvedExercises]);
  const recent=useMemo(()=>Object.keys(store.log??{}).filter(k=>k.startsWith("done__")).map(k=>{const rest=k.slice(6);const sep=rest.lastIndexOf("__");if(sep<0)return null;const date=rest.slice(0,sep);const sessId=rest.slice(sep+2);return isValidDate(date)&&sessId?{date,sessId}:null;}).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,2),[store.log]);

  const recoveryData=useMemo(()=>["push","pull","legs","sprint"].map(sid=>{
    const sess=SESSIONS.find(s=>s.id===sid);
    const last=getLastTrainedDate(store.log,sid);
    const days=last?daysSince(last):null;
    return {sid,sess,days};
  }),[store.log]);
  const recommended=useMemo(()=>recoveryData.filter(r=>r.sid!=="sprint").slice().sort((a,b)=>{
    if(a.days==null) return -1;
    if(b.days==null) return 1;
    return b.days-a.days;
  })[0],[recoveryData]);

  if(showSplash) return <SplashScreen onDone={()=>setShowSplash(false)}/>;

  const wrap=ch=>(
    <div style={{...THEME_VARS[themeMode],position:"relative",minHeight:"100vh",maxHeight:"100vh",maxWidth:520,margin:"0 auto",background:C.bg,overflow:"hidden"}}>
      {(saving||saved)&&<div style={{position:"absolute",top:8,right:12,fontSize:9,color:saving?"var(--gold-88)":C.ok+"99",fontFamily:"monospace",zIndex:999}}>{saving?"saving…":"✓ saved"}</div>}
      <div style={{height:"100%",maxHeight:"100vh",overflowY:"auto",color:C.text,fontFamily:"Georgia,serif",paddingBottom:60,WebkitOverflowScrolling:"touch"}}>
        {ch}
      </div>
    </div>
  );

  if(view==="session"&&active)return wrap(<SessionView sessId={active.sessId} date={active.date} log={store.log} onLog={onLog} onBack={goBack} onComplete={()=>setView("summary")} exList={resolvedExercises[active.sessId]} warmupList={(store.customWarmups?.[active.sessId]?.length?store.customWarmups[active.sessId]:null)??WARMUPS[active.sessId]??[]} cooldownList={(store.customCooldowns?.[active.sessId]?.length?store.customCooldowns[active.sessId]:null)??COOLDOWNS[active.sessId]??[]} onEdit={()=>openExerciseEditor(active.sessId)}/>);
  if(view==="editExercises"&&active)return wrap(<ExerciseEditorView sessId={active.sessId} exList={resolvedExercises[active.sessId]??[]} warmupList={(store.customWarmups?.[active.sessId]?.length?store.customWarmups[active.sessId]:null)??WARMUPS[active.sessId]??[]} cooldownList={(store.customCooldowns?.[active.sessId]?.length?store.customCooldowns[active.sessId]:null)??COOLDOWNS[active.sessId]??[]} onSave={saveExerciseList} onSaveWarmup={saveWarmupList} onSaveCooldown={saveCooldownList} onBack={()=>setView("session")}/>);
  if(view==="summary"&&active)return wrap(<CompletionSummary sessId={active.sessId} date={active.date} log={store.log} onDone={()=>setView("history")} exList={resolvedExercises[active.sessId]}/>);
  if(view==="start")return wrap(<StartPicker onStart={(s,d)=>openSession(s,d,"home")} onStartMobility={(p,d)=>openMobility(p,d,"home")} onBack={()=>setView("home")} themeMode={themeMode}/>);
  if(view==="mobility")return wrap(<MobilityView log={store.log} onLog={onLog} customMobility={store.customMobility} onSaveMobility={saveMobilityList} initialDate={mobilityActive?.date} initialPlanId={mobilityActive?.planId} onBack={()=>{setMobilityActive(null);setView("home");}} themeMode={themeMode}/>);
  if(view==="history")return wrap(<HistoryView log={store.log} onOpen={(s,d)=>openSession(s,d,"history")} onBack={()=>setView("home")} exercises={resolvedExercises} onDeleteSession={deleteSession}/>);
  if(view==="progress")return wrap(<ProgressView log={store.log} onBack={()=>setView("home")} exercises={resolvedExercises}/>);

  return wrap(<>
    <div style={{background: themeMode==="light"
        ? "linear-gradient(160deg,#eeeeee,#f0f0f0,#eeeeee)"
        : "linear-gradient(160deg,#020202,#080808,#030303)",
      borderBottom:`1px solid ${C.border}`,padding:"28px 18px 24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-40,right:-40,width:220,height:220,background:`radial-gradient(circle,${C.gold}0a 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-30,left:-30,width:180,height:180,background:`radial-gradient(circle,${C.push}08 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.gold}55,transparent)`,opacity:.6}}/>
      {/* subtle scanline — CSS only, zero JS cost */}
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.009) 3px,rgba(255,255,255,.009) 4px)",pointerEvents:"none",zIndex:0}}/>
      <DigitalClock mode={themeMode} onToggle={toggleTheme}/>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <AppLogo size={46}/>
        <div>
          <div style={{fontSize:26,letterSpacing:-1,lineHeight:1.15}}>Jayanth's</div>
          <div style={{fontSize:26,letterSpacing:-1,lineHeight:1.15,color:C.gold}}>Workout Tracker</div>
        </div>
      </div>
      <div style={{fontSize:10,color:C.textLow,marginTop:8}}>Transform 365 · MPT Ground</div>
      <div style={{marginTop:SP.md}}>
        <StatCard label="Sessions Logged" value={totalDone} color={C.gold}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:6}}>
          {[
            {label:"Push",  sid:"push",  color:C.push},
            {label:"Pull",  sid:"pull",  color:C.pull},
            {label:"Legs",  sid:["legs","sprint"], color:C.legs},
          ].map(item=>{
            const count = Array.isArray(item.sid)
              ? item.sid.reduce((a,s)=>a+Object.keys(store.log??{}).filter(k=>{const rest=k.slice(6);const sep=rest.lastIndexOf("__");return k.startsWith("done__")&&sep>=0&&rest.slice(sep+2)===s;}).length,0)
              : Object.keys(store.log??{}).filter(k=>{const rest=k.slice(6);const sep=rest.lastIndexOf("__");return k.startsWith("done__")&&sep>=0&&rest.slice(sep+2)===item.sid;}).length;
            return <div key={item.label} style={{background:`linear-gradient(160deg,${item.color}12,${C.surfaceHi})`,
              border:`1px solid ${item.color}44`,borderRadius:10,padding:"9px 4px",textAlign:"center",
              boxShadow:`0 0 14px ${item.color}28`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,
                background:`linear-gradient(90deg,transparent,${item.color}88,transparent)`,
                backgroundSize:"200% 100%",animation:"_inShimmer 2.8s linear 1"}}/>
              <div style={{position:"absolute",inset:0,
                background:`radial-gradient(circle at 50% 60%,${item.color}08 0%,transparent 70%)`,
                animation:"_inGlowPulse 3.2s ease-in-out 2",pointerEvents:"none"}}/>
              <div style={{fontSize:22,color:item.color,fontWeight:700,lineHeight:1,
                textShadow:`0 0 14px ${item.color}99`,
                animation:"_inBeat 4s ease-in-out 2",position:"relative"}}>{count}</div>
              <div style={{fontSize:8,color:C.textLow,marginTop:4,letterSpacing:1,fontFamily:"monospace",textTransform:"uppercase",position:"relative"}}>{item.label}</div>
            </div>;
          })}
        </div>
      </div>
    </div>
    <div style={{padding:`${SP.md}px ${SP.md}px 0`}}>
      <Button onClick={()=>setView("start")} style={{width:"100%",padding:SP.md,fontSize:16,marginBottom:SP.md,
        background:`linear-gradient(135deg,var(--gold-22),${C.push}22)`,
        border:`1px solid var(--gold-45)`,color:C.gold,textAlign:"center",
        boxShadow:`0 0 24px ${C.gold}33`,
        animation:"_inSlideUp .45s cubic-bezier(.22,1,.36,1) both"}}>
        + Log a Workout Session
      </Button>
      <SectionHeader>Quick Start — Today</SectionHeader>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:SP.md}}>
        {[...SESSIONS.map(s=>({...s,onClick:()=>openSession(s.id,todayStr(),"home"),sub2:s.loc})),
          {id:"mobility",label:"Mobility",color:themeMode==="light"?"#000000":"#ffffff",onClick:()=>setView("mobility"),sub2:"Rest day mobility"}
        ].map((s,si)=>(
          <button key={s.id} onClick={s.onClick}
            style={{background:`linear-gradient(160deg,${s.color}12,${C.card})`,
              border:`1px solid ${s.color}55`,borderRadius:12,padding:"15px 12px",
              cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",
              boxShadow:`0 0 18px ${s.color}2a`,position:"relative",overflow:"hidden",
              transition:"box-shadow .2s,transform .15s",
              gridColumn:s.id==="mobility"?"1 / -1":undefined,
              animation:`_inSlideUp .4s cubic-bezier(.22,1,.36,1) ${si*.07}s both`}}>
            {/* animated top shimmer bar */}
            <div style={{position:"absolute",top:0,left:0,right:0,height:1.5,
              background:`linear-gradient(90deg,transparent,${s.color}aa,transparent)`,
              backgroundSize:"200% 100%",animation:"_inShimmer 2.5s linear 1",opacity:.9}}/>
            {/* subtle inner glow pulse */}
            <div style={{position:"absolute",inset:0,
              background:`radial-gradient(ellipse at 30% 40%,${s.color}0c 0%,transparent 65%)`,
              animation:`_inGlowPulse ${2.8+si*.3}s ease-in-out ${si*.4}s 2`,pointerEvents:"none"}}/>
            <div style={{marginBottom:8,position:"relative",animation:`_inFloat ${3.5+si*.4}s ease-in-out ${si*.5}s 2`}}>
              <IconBox color={s.color} size={20}/>
            </div>
            <div style={{fontSize:12,color:s.color,fontWeight:700,
              textShadow:`0 0 10px ${s.color}88`,position:"relative"}}>{s.label}</div>
            <div style={{fontSize:9,color:C.textLow,marginTop:2,position:"relative"}}>{s.sub2}</div>
          </button>
        ))}
      </div>

      <SectionHeader color={C.gold} style={{textShadow:`0 0 8px ${C.gold}`}}>Recovery</SectionHeader>
      <Card style={{padding:SP.md,marginBottom:SP.md,boxShadow:`0 0 12px ${C.gold}11`}}>
        {recoveryData.map(r=><RecoveryBar key={r.sid} label={r.sess.label} icon={r.sess.icon} color={r.sess.color} days={r.days}/>)}
        {recommended&&<div style={{marginTop:6,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:C.textLow}}>Recommended:</span>
          <span style={{fontSize:13,color:recommended.sess.color,fontWeight:700,textShadow:`0 0 8px ${recommended.sess.color}`}}>{recommended.sess.icon} {recommended.sess.label}</span>
        </div>}
      </Card>

      <SectionHeader color={C.pull} style={{textShadow:`0 0 8px ${C.pull}`}}>Consistency</SectionHeader>
      <Card style={{padding:SP.md,marginBottom:SP.md,boxShadow:`0 0 12px ${C.pull}18`}}>
        <Heatmap log={store.log} themeMode={themeMode}/>
      </Card>

      {prs.slice(0,3).length>0&&<><SectionHeader color={C.gold}>Recent PRs</SectionHeader><Card style={{padding:`${SP.sm}px ${SP.md}px`,marginBottom:SP.md}}>{prs.slice(0,3).map((p,i)=>(
  <div key={p.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<2?`1px solid ${C.border}33`:"none"}}>
    <div style={{fontSize:12,color:C.text,display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:8,color:p.color,fontFamily:"monospace",background:p.color+"14",border:`1px solid ${p.color}33`,borderRadius:3,padding:"1px 4px"}}>#{i+1}</span>
      {p.icon} {p.name}
    </div>
    <div style={{fontSize:14,color:p.color,fontWeight:700,textShadow:`0 0 8px ${p.color}66`,fontFamily:"monospace"}}>{p.kg} kg</div>
  </div>
))}</Card></>}
      {recent.length>0&&<><SectionHeader color={C.textMid}>Recent</SectionHeader>{recent.map(r=>{const m=SESSIONS.find(s=>s.id===r.sessId)??{icon:"?",label:r.sessId,color:C.textMid};return <div key={`${r.date}__${r.sessId}`} onClick={()=>openSession(r.sessId,r.date,"home")} style={{background:`linear-gradient(135deg,${m.color}08,${C.card})`,border:`1px solid ${m.color}33`,borderRadius:11,padding:"11px 13px",marginBottom:7,cursor:"pointer",display:"grid",gridTemplateColumns:"44px 1fr auto",gap:SP.sm,alignItems:"center",boxShadow:`0 0 8px ${m.color}14`,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${m.color}44,transparent)`,opacity:.7}}/>
    <IconBox color={m.color} size={20}/>
    <div><div style={{fontSize:13,color:C.text}}>{m.label}</div><div style={{fontSize:10,color:C.textLow,marginTop:1,fontFamily:"monospace"}}>{fmtDate(r.date)}</div></div>
    <div style={{fontSize:18,color:m.color,opacity:.6}}>›</div>
  </div>;})}</>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SP.sm,marginTop:6,marginBottom:SP.md}}>
        {[
          {label:"📋 All Sessions",view:"history",color:C.pull},
          {label:"📊 Progression", view:"progress",color:C.legs},
        ].map((nb,i)=>(
          <button key={nb.view} onClick={()=>setView(nb.view)}
            style={{background:`linear-gradient(135deg,${nb.color}12,${C.card})`,
              border:`1px solid ${nb.color}55`,borderRadius:10,color:nb.color,fontSize:13,
              padding:SP.md,cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"center",
              boxShadow:`0 0 14px ${nb.color}28`,position:"relative",overflow:"hidden",
              transition:"box-shadow .2s"}}>
            {/* shimmer */}
            <div style={{position:"absolute",inset:0,
              background:"linear-gradient(105deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%)",
              backgroundSize:"300% 100%",animation:"_inShimmer 3s linear 1",pointerEvents:"none"}}/>
            <span style={{position:"relative"}}>{nb.label}</span>
          </button>
        ))}
      </div>

      <SectionHeader color={C.textMid}>Backup & Transfer</SectionHeader>
      <Card style={{padding:SP.md,marginBottom:SP.md}}>
        <div style={{fontSize:10,color:C.textLow,lineHeight:1.6,marginBottom:10}}>
          Your data lives on this device only. Export a backup file here, then import it on another phone or browser to bring your history with you.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SP.sm}}>
          <button onClick={exportBackup} style={{background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:12,padding:"10px 8px",cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"center"}}>⬇ Export Backup</button>
          <button onClick={()=>fileInputRef.current?.click()} style={{background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:12,padding:"10px 8px",cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"center"}}>⬆ Import Backup</button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importBackup} style={{display:"none"}}/>
        </div>
        {/* Dev test data loader */}
        <div style={{marginTop:SP.sm,borderTop:`1px solid ${C.border}`,paddingTop:SP.sm}}>
          <button onClick={loadTestData} style={{width:"100%",background:"none",border:`1px solid ${C.sprint}40`,borderRadius:8,color:C.sprint,fontSize:12,padding:"10px 8px",cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"center"}}>
            🧪 Load 30-Day Test Run
          </button>
          <div style={{fontSize:9,color:C.textLow,textAlign:"center",marginTop:5,lineHeight:1.5}}>
            Push/Pull/Legs/Sprint · +2.5kg/wk · Deload W3 · 16 sessions
          </div>
        </div>
        <div style={{marginTop:SP.sm,borderTop:`1px solid ${C.border}`,paddingTop:SP.sm}}>
          {!confirmClear
            ? <button onClick={()=>setConfirmClear(true)} style={{width:"100%",background:"none",border:`1px solid ${C.warn}40`,borderRadius:8,color:C.warn,fontSize:12,padding:"10px 8px",cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"center"}}>🗑 Clear All Workout Entries</button>
            : <div style={{background:C.warn+"0e",border:`1px solid ${C.warn}30`,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:11,color:C.warn,marginBottom:8}}>Delete all logged workout data? This cannot be undone.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SP.sm}}>
                  <button onClick={clearWorkoutData} style={{background:C.warn,border:"none",borderRadius:6,color:"#fff",fontSize:12,padding:"8px 0",cursor:"pointer",fontFamily:"Georgia,serif"}}>Yes, Clear All</button>
                  <button onClick={()=>setConfirmClear(false)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.textMid,fontSize:12,padding:"8px 0",cursor:"pointer",fontFamily:"Georgia,serif"}}>Cancel</button>
                </div>
              </div>
          }
        </div>
        {importMsg&&<div style={{marginTop:8,fontSize:11,color:importMsg.includes("cleared")?C.warn:C.ok,lineHeight:1.5}}>{importMsg}</div>}
      </Card>
    </div>
  </>);
}
