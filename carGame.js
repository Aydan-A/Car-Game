const score = document.querySelector(".scoreLabel");
const scoreText = document.querySelector(".scoreText");
const pauseButton = document.querySelector(".pauseButton");
const startScreen = document.querySelector(".welcomeScreen");
const message = document.querySelector(".message");
const help = document.querySelector(".help");
const bestLine = document.querySelector(".bestLine");
const nameInput = document.querySelector(".nameInput");
const previewTag = document.querySelector(".previewCar .nameTag");
const difficultyInputs = document.querySelectorAll('input[name="difficulty"]');
const filterButtons = document.querySelectorAll(".filterButton");
const startButton = document.querySelector(".startButton");
const recordsButton = document.querySelector(".recordsButton");
const recordsScreen = document.querySelector(".recordsScreen");
const topList = document.querySelector(".topList");
const recentList = document.querySelector(".recentList");
const backButton = document.querySelector(".backButton");
const gameArea = document.querySelector(".gameArea");
const pauseScreen = document.querySelector(".pauseScreen");

const LEVEL_SECONDS = 10; // the red cars get faster every 10 seconds
// Speeds are px per frame at 60 fps, delays are seconds between red cars
const DIFFICULTIES = {
  easy: { label: "Easy", carSpeed: 5, startSpeed: 3, maxSpeed: 8, speedStep: 0.5, startDelay: 1.7, minDelay: 0.8 },
  normal: { label: "Normal", carSpeed: 5, startSpeed: 4, maxSpeed: 11, speedStep: 0.8, startDelay: 1.4, minDelay: 0.5 },
  hard: { label: "Hard", carSpeed: 6, startSpeed: 5.5, maxSpeed: 13, speedStep: 1, startDelay: 1.1, minDelay: 0.4 },
};
const STEER_TIME = 0.45; // extra seconds between red cars so there is always time to steer around
const LINE_GAP = 160;
const CRASH_DELAY = 700;
const RECORDS_KEY = "carGame.records";
const SETTINGS_KEY = "carGame.settings";
const DEFAULT_NAME = "Driver";
const MAX_SAVED_GAMES = 100;

startButton.addEventListener("click", start);
recordsButton.addEventListener("click", showRecords);
backButton.addEventListener("click", showWelcome);
nameInput.addEventListener("input", () => {
  settings.name = nameInput.value;
  previewTag.textContent = driverName();
  saveSettings();
});
difficultyInputs.forEach((input) =>
  input.addEventListener("change", () => {
    settings.difficulty = input.value;
    updateBestLine();
    saveSettings();
  }),
);
filterButtons.forEach((button) => button.addEventListener("click", () => fillRecords(button.dataset.difficulty)));
document.addEventListener("keydown", pressOn);
document.addEventListener("keyup", pressOff);

let settings = loadSettings();

let player = {
  speed: 5,
  score: 0,
  best: 0,
  time: 0,
  enemySpeed: 0,
  nextEnemyIn: 0,
  lastFrame: 0,
  frameId: null,
  crashTimer: null,
  start: false,
  paused: false,
};

let keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

let touch = null; // finger position on the road while dragging

nameInput.value = settings.name;
previewTag.textContent = driverName();
difficultyInputs.forEach((input) => (input.checked = input.value === settings.difficulty));
showWelcome();

function difficulty() {
  return DIFFICULTIES[settings.difficulty];
}

function driverName() {
  return settings.name.trim() || DEFAULT_NAME;
}

function isTouchScreen() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function showMessage(lines) {
  message.replaceChildren();
  lines.forEach(([text, className]) => {
    const p = document.createElement("p");
    p.textContent = text;
    if (className) p.className = className;
    message.appendChild(p);
  });
}

function showHelp() {
  const cards = isTouchScreen()
    ? [["👆", "Drag on the road to move"], ["⏸", "Tap to pause"]]
    : [["← ↑ ↓ →", "to move"], ["P / Esc", "to pause"]];
  help.replaceChildren();
  cards.forEach(([shortcut, text]) => {
    const card = document.createElement("div");
    card.className = "helpCard";
    const keysText = document.createElement("span");
    keysText.className = "helpKeys";
    keysText.textContent = shortcut;
    const label = document.createElement("span");
    label.textContent = text;
    card.append(keysText, label);
    help.appendChild(card);
  });
}

function showWelcome() {
  recordsScreen.classList.add("hide");
  startScreen.classList.remove("hide");
  showMessage([
    ["🏎️ Car Game", "title"],
    ["Pick your level, write your name on the car and avoid the red cars. They get faster every 10 seconds!", "hint"],
  ]);
  showHelp();
  startButton.textContent = "Start Race";
  updateBestLine();
}

function updateBestLine() {
  player.best = bestScore(settings.difficulty);
  const label = difficulty().label;
  bestLine.textContent = player.best > 0 ? `Best on ${label}: ${player.best}s` : `No ${label} games yet. Set the first record!`;
}

function showRecords() {
  fillRecords(settings.difficulty);
  startScreen.classList.add("hide");
  recordsScreen.classList.remove("hide");
  backButton.focus({ preventScroll: true });
}

function fillRecords(level) {
  const records = loadRecords().filter((record) => record.difficulty === level);
  const top = [...records].sort((a, b) => b.score - a.score).slice(0, 10);
  const recent = [...records].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 10);
  fillList(topList, top, true);
  fillList(recentList, recent, false);
  filterButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.difficulty === level)));
}

function fillList(list, records, numbered) {
  list.replaceChildren();
  if (records.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No games yet.";
    list.appendChild(empty);
    return;
  }
  records.forEach((record, index) => {
    const item = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    const name = document.createElement("span");
    name.className = "driver";
    name.textContent = `${numbered ? `${index + 1}. ` : ""}${record.name}`;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = formatDate(record.date);
    who.append(name, when);
    const seconds = document.createElement("span");
    seconds.className = "seconds";
    seconds.textContent = `${record.score}s`;
    item.append(who, seconds);
    list.appendChild(item);
  });
}

function formatDate(date) {
  return new Date(date).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function callEnemy(road) {
  let enemy = document.createElement("div");
  enemy.setAttribute("class", "enemy");
  gameArea.appendChild(enemy);
  // Anywhere across the road, but always fully on it
  const spawnSide = Math.floor(Math.random() * (road.width - enemy.offsetWidth));
  enemy.style.left = `${spawnSide}px`;
  enemy.style.top = `${-enemy.offsetHeight}px`;
}

function nextEnemyDelay(car) {
  const level = Math.floor(player.time / LEVEL_SECONDS);
  const { minDelay, startDelay } = difficulty();
  const planned = Math.max(minDelay, startDelay - level * 0.1) * (0.8 + Math.random() * 0.4);
  // Two red cars never reach the player at the same time, so the road is never blocked.
  const pxPerSecond = player.enemySpeed * 60;
  const safe = (car.offsetHeight * 2) / pxPerSecond + STEER_TIME;
  return Math.max(planned, safe);
}

function start() {
  if (player.start) return;
  clearTimeout(player.crashTimer);
  startScreen.classList.add("hide");
  recordsScreen.classList.add("hide");
  gameArea.classList.remove("hide");
  score.classList.remove("hide");
  pauseScreen.classList.add("hide");

  // Clear anything left from the last game before adding new pieces
  gameArea.querySelectorAll(".enemy, .line, .car").forEach((item) => item.remove());

  player.start = true;
  player.paused = false;
  player.score = 0;
  player.time = 0;
  player.speed = difficulty().carSpeed;
  player.enemySpeed = difficulty().startSpeed;
  player.best = bestScore(settings.difficulty);
  player.nextEnemyIn = 0.6;
  touch = null;
  releaseKeys();
  updateScore();
  pauseButton.textContent = "⏸";
  pauseButton.setAttribute("aria-label", "Pause");

  const road = gameArea.getBoundingClientRect();
  const lineCount = Math.ceil(road.height / LINE_GAP) + 1;
  for (let i = 0; i < lineCount; i++) {
    let line = document.createElement("div");
    line.classList.add("line");
    line.style.top = `${i * LINE_GAP - LINE_GAP}px`;
    gameArea.appendChild(line);
  }

  let car = document.createElement("div");
  car.setAttribute("class", "car");
  let nameTag = document.createElement("span");
  nameTag.className = "nameTag";
  nameTag.textContent = driverName();
  car.appendChild(nameTag);
  gameArea.appendChild(car);

  player.x = (road.width - car.offsetWidth) / 2;
  player.y = 20;
  car.style.left = player.x + "px";
  car.style.bottom = player.y + "px";

  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  player.lastFrame = performance.now();
  player.frameId = window.requestAnimationFrame(playGame);
}

function playGame(timestamp) {
  if (!player.start || player.paused) return;

  // Move by real time, so the game runs at the same speed on 60 Hz and 120 Hz screens
  const seconds = Math.min(Math.max((timestamp - player.lastFrame) / 1000, 0), 0.05);
  const frames = seconds * 60;
  player.lastFrame = timestamp;

  let car = gameArea.querySelector(".car");
  let road = gameArea.getBoundingClientRect();

  player.time += seconds;
  if (Math.floor(player.time) !== player.score) {
    player.score = Math.floor(player.time);
    updateScore();
  }
  const level = Math.floor(player.time / LEVEL_SECONDS);
  const { maxSpeed, startSpeed, speedStep } = difficulty();
  player.enemySpeed = Math.min(maxSpeed, startSpeed + level * speedStep);

  moveCar(car, road, frames);
  moveLines(road, frames);

  player.nextEnemyIn -= seconds;
  if (player.nextEnemyIn <= 0) {
    callEnemy(road);
    player.nextEnemyIn = nextEnemyDelay(car);
  }

  let enemies = document.querySelectorAll(".enemy");
  enemies.forEach((enemy) => {
    const top = parseFloat(enemy.style.top) + player.enemySpeed * frames;
    if (top > road.height) {
      enemy.remove();
    } else {
      enemy.style.top = `${top}px`;
    }
  });

  for (const enemy of document.querySelectorAll(".enemy")) {
    if (isCollison(car, enemy)) {
      gameOver(enemy);
      return;
    }
  }

  player.frameId = window.requestAnimationFrame(playGame);
}

function moveCar(car, road, frames) {
  const step = player.speed * frames;
  const maxX = road.width - car.offsetWidth;
  const maxY = road.height - car.offsetHeight;

  if (touch) {
    // Follow the finger, keeping the car just above it so it stays visible
    const targetX = touch.x - car.offsetWidth / 2;
    const targetY = road.height - touch.y + 24;
    const touchStep = step * 1.5;
    player.x += Math.min(Math.max(targetX - player.x, -touchStep), touchStep);
    player.y += Math.min(Math.max(targetY - player.y, -touchStep), touchStep);
  } else {
    if (keys.ArrowUp) player.y += step;
    if (keys.ArrowDown) player.y -= step;
    if (keys.ArrowLeft) player.x -= step;
    if (keys.ArrowRight) player.x += step;
  }

  player.x = Math.min(Math.max(player.x, 0), maxX);
  player.y = Math.min(Math.max(player.y, 0), maxY);
  car.style.left = player.x + "px";
  car.style.bottom = player.y + "px";
}

function moveLines(road, frames) {
  const lines = document.querySelectorAll(".line");
  lines.forEach((line) => {
    // The road moves faster than the red cars, so they look like they are driving too
    let top = parseFloat(line.style.top) + player.enemySpeed * 1.6 * frames;
    if (top > road.height) top -= lines.length * LINE_GAP;
    line.style.top = `${top}px`;
  });
}

function gameOver(enemy) {
  player.start = false;
  window.cancelAnimationFrame(player.frameId);
  releaseKeys();
  touch = null;
  enemy.classList.add("hit");

  const previousBest = player.best;
  saveGame();
  const newBest = player.score > previousBest;

  player.crashTimer = setTimeout(() => {
    startScreen.classList.remove("hide");
    gameArea.classList.add("hide");
    score.classList.add("hide");
    showMessage(
      [
        ["💥 Game Over!", "title"],
        [`${driverName()}, ${player.score} ${player.score === 1 ? "second" : "seconds"} you've been in the game on ${difficulty().label}.`, "hint"],
        newBest ? ["New best score!", "newBest"] : null,
      ].filter(Boolean),
    );
    showHelp();
    startButton.textContent = "Race Again";
    updateBestLine();
    document.querySelectorAll(".enemy").forEach((item) => item.remove());
    gameArea.querySelectorAll(".car").forEach((item) => item.remove());
  }, CRASH_DELAY);
}

function updateScore() {
  scoreText.textContent = `Score: ${player.score}s`;
}

function pauseGame() {
  if (!player.start || player.paused) return;
  player.paused = true;
  window.cancelAnimationFrame(player.frameId);
  releaseKeys();
  touch = null;
  pauseScreen.classList.remove("hide");
  pauseButton.textContent = "▶";
  pauseButton.setAttribute("aria-label", "Continue");
}

function resumeGame() {
  if (!player.start || !player.paused) return;
  player.paused = false;
  pauseScreen.classList.add("hide");
  pauseButton.textContent = "⏸";
  pauseButton.setAttribute("aria-label", "Pause");
  player.lastFrame = performance.now();
  player.frameId = window.requestAnimationFrame(playGame);
}

function togglePause() {
  if (player.paused) resumeGame();
  else pauseGame();
}

function isCollison(a, b) {
  const aRect = a.getBoundingClientRect();
  const bRect = b.getBoundingClientRect();
  const gap = 5; // the car corners are round, so ignore a few pixels at the edges
  return !(
    aRect.bottom - gap < bRect.top + gap ||
    aRect.top + gap > bRect.bottom - gap ||
    aRect.right - gap < bRect.left + gap ||
    aRect.left + gap > bRect.right - gap
  );
}

function releaseKeys() {
  Object.keys(keys).forEach((key) => (keys[key] = false));
}

function pressOn(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (Object.hasOwn(keys, e.key)) {
    // Only stop the page from scrolling while the game is running
    if (player.start) {
      e.preventDefault();
      keys[e.key] = true;
    }
    return;
  }

  if (player.start && (e.key === "p" || e.key === "P" || e.key === "Escape")) {
    e.preventDefault();
    togglePause();
    return;
  }

  if (!player.start && !recordsScreen.classList.contains("hide") && e.key === "Escape") {
    showWelcome();
    return;
  }

  // Enter starts the game, unless a button has the focus and handles the key itself
  if (!player.start && !startScreen.classList.contains("hide") && e.key === "Enter" && !e.target.closest("button")) {
    e.preventDefault();
    start();
  }
}

function pressOff(e) {
  if (Object.hasOwn(keys, e.key)) keys[e.key] = false;
}

function roadPoint(e) {
  const road = gameArea.getBoundingClientRect();
  return { x: e.clientX - road.left, y: e.clientY - road.top };
}

gameArea.addEventListener("pointerdown", (e) => {
  if (!player.start || player.paused || e.target.closest(".pauseScreen")) return;
  gameArea.setPointerCapture(e.pointerId);
  touch = roadPoint(e);
});

gameArea.addEventListener("pointermove", (e) => {
  if (touch && gameArea.hasPointerCapture(e.pointerId)) touch = roadPoint(e);
});

["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
  gameArea.addEventListener(type, () => (touch = null));
});

pauseButton.addEventListener("click", togglePause);
pauseScreen.addEventListener("click", resumeGame);

// Pause when the player switches tabs or apps
window.addEventListener("blur", pauseGame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

function loadRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
    if (!Array.isArray(records)) return [];
    return records
      .filter((record) => record && Number.isFinite(record.score) && !Number.isNaN(Date.parse(record.date)))
      .map((record) => ({
        ...record,
        // Games saved before names and levels were added count as Normal
        name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : DEFAULT_NAME,
        difficulty: Object.hasOwn(DIFFICULTIES, record.difficulty) ? record.difficulty : "normal",
      }));
  } catch {
    return [];
  }
}

function saveGame() {
  const game = { score: player.score, date: new Date().toISOString(), name: driverName(), difficulty: settings.difficulty };
  const records = [...loadRecords(), game].slice(-MAX_SAVED_GAMES);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Storage can be blocked (private mode); the games just won't be kept
  }
}

function bestScore(level) {
  return loadRecords()
    .filter((record) => record.difficulty === level)
    .reduce((best, record) => Math.max(best, record.score), 0);
}

function loadSettings() {
  const saved = { name: "", difficulty: "normal" };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (typeof stored.name === "string") saved.name = stored.name.slice(0, 10);
    if (Object.hasOwn(DIFFICULTIES, stored.difficulty)) saved.difficulty = stored.difficulty;
  } catch {
    // Use the defaults
  }
  return saved;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked; the choice just won't be remembered
  }
}
