# Car Game

A playful top-down car game for the browser. Dodge the traffic, survive as long as you can, and beat your own records. The road gets faster every 15 seconds.

**Play it:** https://aydan-a.github.io/Car-Game/

## Features
- Three difficulties: 🐢 Easy, 🚗 Normal and 🔥 Hard.
- Levels: every 15 seconds the traffic speeds up and gets busier.
- Fair traffic: cars come in rows of one or two, never three, and rows are spaced so there is always time to reach the free lane.
- A 3-2-1 countdown, a pause menu, and a crash screen with time, cars dodged, level reached and your best.
- Records saved in the browser (localStorage) with the date: a Top 10 and recent races for each difficulty, plus a "New record!" badge.
- Works on phones: drag on the road or hold the ◀ ▶ buttons. The game pauses by itself when you switch tabs.

## How to Play
| Action | Keyboard | Phone / tablet |
|---|---|---|
| Steer | `←` `→` `↑` `↓` or `W` `A` `S` `D` | Drag on the road, or hold ◀ ▶ |
| Pause / resume | `P`, `Esc` or `Space` | ⏸ button |
| Race again | `Enter` on the crash screen | Race Again button |

Click the logo at any time to go back to the dashboard.

## Run Locally
No build step is needed.

```bash
git clone https://github.com/Aydan-A/Car-Game.git
cd Car-Game
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also open `index.html` directly.

## Technologies Used
- **HTML** for the screens (dashboard, race, crash, records).
- **CSS** for the layout, the moving road and the car colors (the same car image is recolored with `filter: hue-rotate`).
- **JavaScript** for the `requestAnimationFrame` game loop, frame-rate independent movement, collision detection, the traffic spawner and saved records.

## License
This project is open-source and available under the MIT License.
