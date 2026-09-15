const score = document.querySelector(".scoreLabel");
const scoreText = document.querySelector(".scoreText");
const pauseButton = document.querySelector(".pauseButton");
const startScreen = document.querySelector(".welcomeScreen");
const message = document.querySelector(".message");
const help = document.querySelector(".help");
const bestLine = document.querySelector(".bestLine");
const startButton = document.querySelector(".startButton");
const recordsButton = document.querySelector(".recordsButton");
const recordsScreen = document.querySelector(".recordsScreen");
const topList = document.querySelector(".topList");
const recentList = document.querySelector(".recentList");
const backButton = document.querySelector(".backButton");
const gameArea = document.querySelector(".gameArea");
const pauseScreen = document.querySelector(".pauseScreen");

const LEVEL_SECONDS = 10; // the red cars get faster every 10 seconds
const START_ENEMY_SPEED = 4; // px per frame at 60 fps, same unit as player.speed
const MAX_ENEMY_SPEED = 11;
const START_ENEMY_DELAY = 1.4; // seconds between red cars
const MIN_ENEMY_DELAY = 0.5;
const STEER_TIME = 0.45; // extra seconds between red cars so there is always time to steer around
const LINE_GAP = 160;
const CRASH_DELAY = 700;
const RECORDS_KEY = "carGame.records";
const MAX_SAVED_GAMES = 100;

startButton.addEventListener("click", start);
recordsButton.addEventListener("click", showRecords);
backButton.addEventListener("click", showWelcome);
document.addEventListener("keydown", pressOn);
document.addEventListener("keyup", pressOff);

let player = {
  speed: 5,
  score: 0,
  best: bestScore(),
  time: 0,
  enemySpeed: START_ENEMY_SPEED,
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

showWelcome();

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
    ["Avoid the red cars and stay in the game as long as you can. They get faster every 10 seconds!", "hint"],
  ]);
  showHelp();
  startButton.textContent = "Start Race";
  updateBestLine();
}

function updateBestLine() {
  player.best = bestScore();
  bestLine.textContent = player.best > 0 ? `Best: ${player.best}s` : "No games yet. Set the first record!";
}

function showRecords() {
  const records = loadRecords();
  const top = [...records].sort((a, b) => b.score - a.score).slice(0, 10);
  const recent = [...records].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 10);
  fillList(topList, top, true);
  fillList(recentList, recent, false);
  startScreen.classList.add("hide");
  recordsScreen.classList.remove("hide");
  backButton.focus({ preventScroll: true });
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
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = `${numbered ? `${index + 1}. ` : ""}${formatDate(record.date)}`;
    const seconds = document.createElement("span");
    seconds.className = "seconds";
    seconds.textContent = `${record.score}s`;
    item.append(when, seconds);
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
  const planned = Math.max(MIN_ENEMY_DELAY, START_ENEMY_DELAY - level * 0.1) * (0.8 + Math.random() * 0.4);
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
  player.enemySpeed = START_ENEMY_SPEED;
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

  let car = document.querySelector(".car");
  let road = gameArea.getBoundingClientRect();

  player.time += seconds;
  if (Math.floor(player.time) !== player.score) {
    player.score = Math.floor(player.time);
    updateScore();
  }
  const level = Math.floor(player.time / LEVEL_SECONDS);
  player.enemySpeed = Math.min(MAX_ENEMY_SPEED, START_ENEMY_SPEED + level * 0.8);

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
        [`${player.score} ${player.score === 1 ? "second" : "seconds"} you've been in the game.`, "hint"],
        newBest ? ["New best score!", "newBest"] : null,
      ].filter(Boolean),
    );
    showHelp();
    startButton.textContent = "Race Again";
    updateBestLine();
    document.querySelectorAll(".enemy").forEach((item) => item.remove());
    document.querySelectorAll(".car").forEach((item) => item.remove());
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
    return records.filter((record) => record && Number.isFinite(record.score) && !Number.isNaN(Date.parse(record.date)));
  } catch {
    return [];
  }
}

function saveGame() {
  const records = [...loadRecords(), { score: player.score, date: new Date().toISOString() }].slice(-MAX_SAVED_GAMES);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Storage can be blocked (private mode); the games just won't be kept
  }
}

function bestScore() {
  return loadRecords().reduce((best, record) => Math.max(best, record.score), 0);
}
