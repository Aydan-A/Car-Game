"use strict";

// Speeds are in road heights per second, so the game feels the same on any screen size.
const DIFFICULTIES = {
  easy: { name: "Easy", startSpeed: 0.36, maxSpeed: 0.8, rowEvery: 1.6, doubleChance: 0.1 },
  normal: { name: "Normal", startSpeed: 0.48, maxSpeed: 1.05, rowEvery: 1.25, doubleChance: 0.25 },
  hard: { name: "Hard", startSpeed: 0.62, maxSpeed: 1.3, rowEvery: 1.0, doubleChance: 0.4 },
};
const LEVEL_SECONDS = 15;
const LANES = 3;
const CAR_RATIO = 140 / 68; // height / width of the car drawn in Pics/car.webp
const ENEMY_COLORS = 5;
const STEER_SPEED = 1.6; // road widths per second
const VERTICAL_SPEED = 0.8; // road heights per second
// Time between rows to cross two lanes: about 0.42s of steering at STEER_SPEED plus reaction time.
const LANE_CHANGE_TIME = 0.75;
const COUNTDOWN_SECONDS = 3;
const CRASH_DELAY_MS = 900;
const MAX_SAVED_RACES = 100;
const STORAGE = {
  records: "carGame.records.v1",
  name: "carGame.name",
  difficulty: "carGame.difficulty",
};

const $ = (selector) => document.querySelector(selector);

const screens = {
  dashboard: $(".dashboard-screen"),
  game: $(".game-screen"),
  result: $(".result-screen"),
  records: $(".records-screen"),
};

const ui = {
  logo: $(".logo"),
  form: $(".setup-form"),
  nameInput: $("#driver-name"),
  bestLine: $(".best-line"),
  recordsBtn: $(".records-btn"),
  hudTime: $(".hud-time"),
  hudLevel: $(".hud-level"),
  hudDodged: $(".hud-dodged"),
  hudBest: $(".hud-best"),
  pauseBtn: $(".pause-btn"),
  roadFrame: $(".road-frame"),
  road: $(".road"),
  player: $(".player-car"),
  countdown: $(".countdown"),
  toast: $(".toast"),
  pauseOverlay: $(".pause-overlay"),
  resumeBtn: $(".resume-btn"),
  quitBtn: $(".quit-btn"),
  touchButtons: document.querySelectorAll(".touch-btn"),
  announcer: $(".game-announcer"),
  resultTitle: $(".result-title"),
  newRecord: $(".new-record"),
  resultSummary: $(".result-summary"),
  resultTime: $(".result-time"),
  resultDodged: $(".result-dodged"),
  resultLevel: $(".result-level"),
  resultBest: $(".result-best"),
  resultDifficulty: $(".result-difficulty"),
  againBtn: $(".again-btn"),
  dashboardBtn: $(".dashboard-btn"),
  recordsTitle: $(".records-title"),
  topList: $(".top-list"),
  recentList: $(".recent-list"),
  recordsBackBtn: $(".records-back-btn"),
};

const metrics = { width: 0, height: 0, laneWidth: 0, carW: 0, carH: 0 };

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  touchLeft: false,
  touchRight: false,
  pointer: null,
};

const game = {
  state: "idle", // idle | countdown | running | paused | crashed
  resumeState: "running",
  difficulty: "normal",
  name: "Player",
  time: 0,
  level: 1,
  dodged: 0,
  best: 0,
  countdown: 0,
  rowTimer: 0,
  roadOffset: 0,
  player: { x: 0, y: 0, tilt: 0 },
  enemies: [],
  rafId: 0,
  lastFrame: 0,
  crashTimeout: 0,
  toastTimeout: 0,
  lastRecord: null,
};

/* ---------- Storage ---------- */

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode); the game still works, records just aren't kept.
  }
}

function isValidRecord(record) {
  return (
    record &&
    typeof record.name === "string" &&
    Object.hasOwn(DIFFICULTIES, record.difficulty) &&
    Number.isFinite(record.time) &&
    Number.isFinite(record.dodged) &&
    Number.isFinite(record.level) &&
    !Number.isNaN(Date.parse(record.date))
  );
}

function loadRecords() {
  try {
    const records = JSON.parse(readStorage(STORAGE.records, "[]"));
    return Array.isArray(records) ? records.filter(isValidRecord) : [];
  } catch {
    return [];
  }
}

function bestTime(difficulty) {
  return loadRecords()
    .filter((record) => record.difficulty === difficulty)
    .reduce((best, record) => Math.max(best, record.time), 0);
}

function saveRace() {
  const previousBest = bestTime(game.difficulty);
  const record = {
    name: game.name,
    difficulty: game.difficulty,
    time: Math.round(game.time * 10) / 10,
    dodged: game.dodged,
    level: game.level,
    date: new Date().toISOString(),
  };
  const records = [...loadRecords(), record].slice(-MAX_SAVED_RACES);
  writeStorage(STORAGE.records, JSON.stringify(records));
  return { record, isNewRecord: record.time > previousBest, best: Math.max(previousBest, record.time) };
}

/* ---------- Helpers ---------- */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function formatTime(seconds) {
  return `${seconds.toFixed(1)}s`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function selectedDifficulty() {
  return ui.form.elements.difficulty.value || "normal";
}

function currentSpeed() {
  const settings = DIFFICULTIES[game.difficulty];
  return Math.min(settings.maxSpeed, settings.startSpeed * (1 + 0.14 * (game.level - 1)));
}

function announce(message) {
  ui.announcer.textContent = message;
}

/* ---------- Screens ---------- */

function showScreen(name) {
  for (const [key, screen] of Object.entries(screens)) {
    screen.hidden = key !== name;
  }
  document.body.classList.toggle("playing", name === "game");
}

function goToDashboard() {
  endRace();
  updateBestLine();
  showScreen("dashboard");
  ui.form.querySelector(".start-btn").focus({ preventScroll: true });
}

function updateBestLine() {
  const difficulty = selectedDifficulty();
  const best = bestTime(difficulty);
  ui.bestLine.replaceChildren();
  if (best > 0) {
    const strong = document.createElement("strong");
    strong.textContent = formatTime(best);
    ui.bestLine.append(`Your best on ${DIFFICULTIES[difficulty].name}: `, strong);
  } else {
    ui.bestLine.textContent = `No races on ${DIFFICULTIES[difficulty].name} yet. Set the first record!`;
  }
}

/* ---------- Road size ---------- */

function measureRoad() {
  const width = ui.road.clientWidth;
  const height = ui.road.clientHeight;
  if (!width || !height) return; // hidden screens measure 0; keep the last real size

  const oldWidth = metrics.width;
  const oldHeight = metrics.height;
  const oldCarH = metrics.carH;

  metrics.width = width;
  metrics.height = height;
  metrics.laneWidth = width / LANES;
  metrics.carW = Math.round(Math.min(metrics.laneWidth * 0.5, 72, (height * 0.2) / CAR_RATIO));
  metrics.carH = Math.round(metrics.carW * CAR_RATIO);
  ui.road.style.setProperty("--car-w", `${metrics.carW}px`);
  ui.road.style.setProperty("--car-h", `${metrics.carH}px`);

  // Keep everything in the same relative place when the window changes size mid-race.
  if (oldWidth && oldHeight && (oldWidth !== width || oldHeight !== height)) {
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;
    game.player.x = clamp(game.player.x * scaleX, 0, width - metrics.carW);
    game.player.y = clamp(game.player.y * scaleY, 0, height - metrics.carH);
    for (const enemy of game.enemies) {
      enemy.x = laneX(enemy.lane, enemy.jitter);
      enemy.y = (enemy.y + oldCarH) * scaleY - metrics.carH;
    }
    render();
  }
}

function laneX(lane, jitter) {
  return (lane + 0.5) * metrics.laneWidth - metrics.carW / 2 + jitter * metrics.laneWidth;
}

/* ---------- Race lifecycle ---------- */

function startRace() {
  endRace();

  game.difficulty = selectedDifficulty();
  game.name = ui.nameInput.value.trim() || "Player";
  writeStorage(STORAGE.name, game.name);
  writeStorage(STORAGE.difficulty, game.difficulty);

  game.time = 0;
  game.level = 1;
  game.dodged = 0;
  game.best = bestTime(game.difficulty);
  game.roadOffset = 0;
  game.rowTimer = 0.4;
  game.countdown = COUNTDOWN_SECONDS;
  game.player.tilt = 0;

  ui.roadFrame.classList.remove("crashed");
  ui.pauseOverlay.hidden = true;
  ui.hudBest.textContent = game.best > 0 ? formatTime(game.best) : "–";
  ui.hudTime.classList.remove("is-record");

  showScreen("game");
  measureRoad();
  game.player.x = (metrics.width - metrics.carW) / 2;
  game.player.y = metrics.height - metrics.carH - Math.max(12, metrics.height * 0.05);

  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  updateHud();
  render();
  setCountdownText(String(COUNTDOWN_SECONDS));
  announce(`Race starts in ${COUNTDOWN_SECONDS} seconds on ${DIFFICULTIES[game.difficulty].name}.`);
  game.state = "countdown";
  startLoop();
}

function endRace() {
  stopLoop();
  clearTimeout(game.crashTimeout);
  clearTimeout(game.toastTimeout);
  for (const enemy of game.enemies) enemy.el.remove();
  game.enemies = [];
  game.state = "idle";
  resetInput();
  ui.toast.classList.remove("show");
  ui.countdown.textContent = "";
  ui.pauseOverlay.hidden = true;
}

function pauseRace() {
  if (game.state !== "running" && game.state !== "countdown") return;
  game.resumeState = game.state;
  game.state = "paused";
  stopLoop();
  resetInput();
  ui.pauseOverlay.hidden = false;
  ui.pauseBtn.setAttribute("aria-label", "Resume");
  ui.pauseBtn.textContent = "▶";
  ui.resumeBtn.focus({ preventScroll: true });
  announce("Paused.");
}

function resumeRace() {
  if (game.state !== "paused") return;
  game.state = game.resumeState;
  ui.pauseOverlay.hidden = true;
  ui.pauseBtn.setAttribute("aria-label", "Pause");
  ui.pauseBtn.textContent = "⏸";
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  startLoop();
}

function togglePause() {
  if (game.state === "paused") resumeRace();
  else pauseRace();
}

function crash(enemy) {
  game.state = "crashed";
  stopLoop();
  resetInput();
  enemy.el.classList.add("is-hit");
  ui.roadFrame.classList.add("crashed");
  game.lastRecord = saveRace();
  announce(`Crash! You survived ${formatTime(game.time)}.`);
  game.crashTimeout = setTimeout(showResults, CRASH_DELAY_MS);
}

function showResults() {
  const { record, isNewRecord, best } = game.lastRecord;
  endRace();

  ui.newRecord.hidden = !isNewRecord;
  ui.resultSummary.textContent = `${record.name} survived ${formatTime(record.time)} on ${DIFFICULTIES[record.difficulty].name}.`;
  ui.resultTime.textContent = formatTime(record.time);
  ui.resultDodged.textContent = String(record.dodged);
  ui.resultLevel.textContent = String(record.level);
  ui.resultBest.textContent = formatTime(best);
  ui.resultDifficulty.textContent = DIFFICULTIES[record.difficulty].name;

  showScreen("result");
  ui.resultTitle.focus({ preventScroll: true });
}

/* ---------- Game loop ---------- */

function startLoop() {
  cancelAnimationFrame(game.rafId);
  game.lastFrame = performance.now();
  game.rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  cancelAnimationFrame(game.rafId);
  game.rafId = 0;
}

function frame(now) {
  // Clamp the step so a slow frame can't teleport cars through each other.
  const dt = Math.min((now - game.lastFrame) / 1000, 0.05);
  game.lastFrame = now;

  update(dt);
  render();

  if (game.state === "countdown" || game.state === "running") {
    game.rafId = requestAnimationFrame(frame);
  }
}

function update(dt) {
  if (game.state === "countdown") {
    const before = Math.ceil(game.countdown);
    game.countdown -= dt;
    const after = Math.ceil(game.countdown);
    if (after <= 0) {
      game.state = "running";
      setCountdownText("GO!");
      game.toastTimeout = setTimeout(() => {
        if (ui.countdown.textContent === "GO!") ui.countdown.textContent = "";
      }, 600);
      announce("Go!");
    } else if (after !== before) {
      setCountdownText(String(after));
    }
    return;
  }

  if (game.state !== "running") return;

  game.time += dt;
  const level = 1 + Math.floor(game.time / LEVEL_SECONDS);
  if (level !== game.level) {
    game.level = level;
    showToast(`Level ${level} · faster!`);
    announce(`Level ${level}.`);
  }

  const speed = currentSpeed() * metrics.height; // px per second
  game.roadOffset = (game.roadOffset + speed * dt) % 240;

  movePlayer(dt);

  game.rowTimer -= dt;
  if (game.rowTimer <= 0) {
    spawnRow();
    game.rowTimer = nextRowDelay(speed);
  }

  const playerBox = hitbox(game.player.x, game.player.y);
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    enemy.y += speed * dt;
    if (enemy.y > metrics.height) {
      enemy.el.remove();
      game.enemies.splice(i, 1);
      game.dodged++;
      continue;
    }
    if (overlaps(playerBox, hitbox(enemy.x, enemy.y))) {
      updateHud();
      crash(enemy);
      return;
    }
  }

  updateHud();
}

function movePlayer(dt) {
  const player = game.player;
  const maxX = STEER_SPEED * metrics.width * dt;
  const maxY = VERTICAL_SPEED * metrics.height * dt;
  const startX = player.x;

  if (input.pointer) {
    // Follow the finger, keeping the car just above it so it stays visible.
    const targetX = input.pointer.x - metrics.carW / 2;
    const targetY = input.pointer.y - metrics.carH * 1.1;
    player.x += clamp(targetX - player.x, -maxX, maxX);
    player.y += clamp(targetY - player.y, -maxY, maxY);
  } else {
    const dx = (input.right || input.touchRight ? 1 : 0) - (input.left || input.touchLeft ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    player.x += dx * maxX;
    player.y += dy * maxY;
  }

  player.x = clamp(player.x, 0, metrics.width - metrics.carW);
  player.y = clamp(player.y, 0, metrics.height - metrics.carH);

  const moved = player.x - startX;
  const targetTilt = Math.abs(moved) < 0.5 ? 0 : Math.sign(moved);
  player.tilt += (targetTilt - player.tilt) * Math.min(1, dt * 12);
}

// Traffic comes in rows of one or two cars, never three, so there is always a free lane.
// Rows are spaced far enough apart that the player can cross two lanes between them.
function spawnRow() {
  const settings = DIFFICULTIES[game.difficulty];
  const doubleChance = Math.min(0.7, settings.doubleChance + 0.05 * (game.level - 1));
  const count = Math.random() < doubleChance ? 2 : 1;
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, count);

  for (const lane of lanes) {
    const el = document.createElement("div");
    el.className = `car enemy c${Math.floor(Math.random() * ENEMY_COLORS)}`;
    el.setAttribute("aria-hidden", "true");
    const jitter = (Math.random() - 0.5) * 0.12;
    const enemy = { el, lane, jitter, x: laneX(lane, jitter), y: -metrics.carH };
    ui.road.append(el);
    game.enemies.push(enemy);
  }
}

function nextRowDelay(speed) {
  const settings = DIFFICULTIES[game.difficulty];
  const minGap = (2 * metrics.carH + speed * LANE_CHANGE_TIME) / speed;
  const planned = settings.rowEvery * 0.92 ** (game.level - 1) * (1 + Math.random() * 0.35);
  return Math.max(minGap, planned);
}

function hitbox(x, y) {
  const insetX = metrics.carW * 0.14;
  const insetY = metrics.carH * 0.06;
  return { left: x + insetX, right: x + metrics.carW - insetX, top: y + insetY, bottom: y + metrics.carH - insetY };
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/* ---------- Rendering ---------- */

function render() {
  ui.roadFrame.style.setProperty("--road-offset", `${game.roadOffset}px`);
  const { x, y, tilt } = game.player;
  ui.player.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt * 7}deg)`;
  for (const enemy of game.enemies) {
    enemy.el.style.transform = `translate3d(${enemy.x}px, ${enemy.y}px, 0)`;
  }
}

function updateHud() {
  const time = formatTime(game.time);
  if (ui.hudTime.textContent !== time) ui.hudTime.textContent = time;
  const level = String(game.level);
  if (ui.hudLevel.textContent !== level) ui.hudLevel.textContent = level;
  const dodged = String(game.dodged);
  if (ui.hudDodged.textContent !== dodged) ui.hudDodged.textContent = dodged;
  ui.hudTime.classList.toggle("is-record", game.best > 0 && game.time > game.best);
}

function setCountdownText(text) {
  ui.countdown.textContent = text;
  ui.countdown.classList.remove("pop");
  void ui.countdown.offsetWidth; // restart the animation
  ui.countdown.classList.add("pop");
}

function showToast(text) {
  clearTimeout(game.toastTimeout);
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  game.toastTimeout = setTimeout(() => ui.toast.classList.remove("show"), 1400);
}

/* ---------- Records screen ---------- */

function showRecords(difficulty = selectedDifficulty()) {
  const radio = document.querySelector(`input[name="records-difficulty"][value="${difficulty}"]`);
  if (radio) radio.checked = true;
  renderRecords(difficulty);
  showScreen("records");
  ui.recordsTitle.focus({ preventScroll: true });
}

function renderRecords(difficulty) {
  const records = loadRecords().filter((record) => record.difficulty === difficulty);
  const top = [...records].sort((a, b) => b.time - a.time).slice(0, 10);
  const recent = [...records].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 10);
  fillList(ui.topList, top, "No races yet. Go set a record!");
  fillList(ui.recentList, recent, "Your recent races will show up here.");
}

function fillList(list, records, emptyText) {
  list.replaceChildren();
  if (!records.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = emptyText;
    list.append(li);
    return;
  }
  records.forEach((record, index) => {
    const li = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `${index + 1}.`;

    const who = document.createElement("span");
    who.className = "who";
    who.textContent = record.name;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = formatDate(record.date);
    who.append(when);

    const score = document.createElement("span");
    score.className = "score";
    score.textContent = formatTime(record.time);
    const details = document.createElement("small");
    details.textContent = `${record.dodged} dodged · Lv ${record.level}`;
    score.append(details);

    li.append(rank, who, score);
    list.append(li);
  });
}

/* ---------- Input ---------- */

const KEY_DIRECTIONS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  KeyS: "down",
};

function resetInput() {
  input.left = input.right = input.up = input.down = false;
  input.touchLeft = input.touchRight = false;
  input.pointer = null;
  for (const button of ui.touchButtons) button.classList.remove("is-pressed");
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (!screens.game.hidden) {
    const direction = KEY_DIRECTIONS[event.code] || KEY_DIRECTIONS[event.key];
    if (direction && game.state !== "paused") {
      event.preventDefault();
      input[direction] = true;
      return;
    }
    if (event.code === "KeyP" || event.key === "Escape" || (event.code === "Space" && game.state !== "paused")) {
      event.preventDefault();
      togglePause();
    }
    return;
  }

  if (!screens.result.hidden && event.key === "Enter" && event.target === ui.resultTitle) {
    event.preventDefault();
    startRace();
  }
});

document.addEventListener("keyup", (event) => {
  const direction = KEY_DIRECTIONS[event.code] || KEY_DIRECTIONS[event.key];
  if (direction) input[direction] = false;
});

window.addEventListener("blur", () => {
  resetInput();
  pauseRace();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseRace();
});

function roadPoint(event) {
  const rect = ui.road.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

ui.road.addEventListener("pointerdown", (event) => {
  if (game.state !== "running" && game.state !== "countdown") return;
  if (event.button !== 0) return;
  ui.road.setPointerCapture(event.pointerId);
  input.pointer = roadPoint(event);
});

ui.road.addEventListener("pointermove", (event) => {
  if (input.pointer && ui.road.hasPointerCapture(event.pointerId)) input.pointer = roadPoint(event);
});

for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  ui.road.addEventListener(type, () => {
    input.pointer = null;
  });
}

for (const button of ui.touchButtons) {
  const key = button.dataset.dir === "left" ? "touchLeft" : "touchRight";
  const release = () => {
    input[key] = false;
    button.classList.remove("is-pressed");
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    input[key] = true;
    button.classList.add("is-pressed");
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

// Show the ◀ ▶ buttons on touch screens, including hybrids whose main pointer is a mouse.
const coarsePointer = matchMedia("(pointer: coarse)");
const enableTouchUi = () => document.body.classList.add("touch-ui");
if (coarsePointer.matches) enableTouchUi();
coarsePointer.addEventListener("change", (event) => {
  if (event.matches) enableTouchUi();
});
document.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType === "touch") enableTouchUi();
  },
  { capture: true },
);

new ResizeObserver(() => measureRoad()).observe(ui.road);

/* ---------- Buttons ---------- */

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  startRace();
});

ui.form.addEventListener("change", (event) => {
  if (event.target.name === "difficulty") updateBestLine();
});

ui.logo.addEventListener("click", goToDashboard);
ui.recordsBtn.addEventListener("click", () => showRecords());
ui.pauseBtn.addEventListener("click", togglePause);
ui.resumeBtn.addEventListener("click", resumeRace);
ui.quitBtn.addEventListener("click", goToDashboard);
ui.againBtn.addEventListener("click", startRace);
ui.dashboardBtn.addEventListener("click", goToDashboard);
ui.recordsBackBtn.addEventListener("click", goToDashboard);

document.querySelectorAll('input[name="records-difficulty"]').forEach((radio) => {
  radio.addEventListener("change", () => renderRecords(radio.value));
});

/* ---------- Init ---------- */

ui.nameInput.value = readStorage(STORAGE.name, "");
const savedDifficulty = readStorage(STORAGE.difficulty, "normal");
if (Object.hasOwn(DIFFICULTIES, savedDifficulty)) {
  ui.form.elements.difficulty.value = savedDifficulty;
}
updateBestLine();
