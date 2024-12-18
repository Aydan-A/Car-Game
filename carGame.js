const score = document.querySelector(".scoreLabel");
const startScreen = document.querySelector(".welcomeScreen");
const gameArea = document.querySelector(".gameArea");

startScreen.addEventListener("click", start);
document.addEventListener("keydown", pressOn);
document.addEventListener("keyup", pressOff);

let player = {
  speed: 5,
  score: 0,
  intervalId:null,
  start:false
};

let keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

function callEnemy() {
  setInterval(() => {
    if (player.start) {
      let enemy = document.createElement("div");
      enemy.setAttribute("class", "enemy");
      const gameAreaRect = gameArea.getBoundingClientRect();
      const spawnSide = gameAreaRect.width / Math.floor(Math.random() * 5);
      enemy.style.left = `${spawnSide}px`;
      gameArea.appendChild(enemy);
    }
  }, 7500);
}

function start() {
  startScreen.classList.add("hide");
  gameArea.classList.remove("hide");
  score.classList.remove("hide");
  player.start = true;
  player.score = 0;

  player.intervalId = setInterval(() => {
    if (player.start) {
      player.score++;
      score.textContent = `Score: ${player.score}s`;
    }
  }, 1000);

  window.requestAnimationFrame(playGame);

  let line = document.createElement("div");
  line.classList.add("line");
  gameArea.appendChild(line);

  let car = document.createElement("div");
  car.setAttribute("class", "car");
  gameArea.appendChild(car);

  callEnemy();

  player.x = car.offsetLeft;
  player.y = car.offsetTop;
}

function playGame() {
  let car = document.querySelector(".car");
  let road = gameArea.getBoundingClientRect();
  car.style.left = player.x + "px";
  car.style.bottom = player.y + "px";

  if (player.start) {
    if (keys.ArrowUp && player.y < road.height - car.offsetHeight) {
      player.y += player.speed;
    }
    if (keys.ArrowDown && player.y > 0) {
      player.y -= player.speed;
    }
    if (keys.ArrowLeft && player.x > 0) {
      player.x -= player.speed;
    }
    if (keys.ArrowRight && player.x < road.width - car.offsetWidth) {
      player.x += player.speed;
    }

    let enemies = document.querySelectorAll(".enemy");
    enemies.forEach((enemy) => {
      if (isCollison(car, enemy)) {
        player.start = false;
        stopTimer();
        startScreen.classList.remove("hide");
        gameArea.classList.add("hide");
        score.classList.add("hide");
        startScreen.innerHTML = `Game Over! ${player.score} seconds you've been in the game. Click to Restart.`;
        document.querySelectorAll(".enemy").forEach((enemy) => enemy.remove());
        document.querySelectorAll(".car").forEach((enemy) => enemy.remove());
        stopTimer()
      }
    });

    window.requestAnimationFrame(playGame);
   
  }
}

function stopTimer() {
  clearInterval(player.intervalId);
}

function isCollison(a, b) {
  const aRect = a.getBoundingClientRect();
  const bRect = b.getBoundingClientRect();
  return !(
    aRect.bottom < bRect.top ||
    aRect.top > bRect.bottom ||
    aRect.right < bRect.left ||
    aRect.left > bRect.right
  );
}

function pressOn(e) {
  e.preventDefault();
  keys[e.key] = true;
}

function pressOff(e) {
  e.preventDefault();
  keys[e.key] = false;
}
