# Car Racing Game

A simple browser-based car racing game where players can control a car, avoid enemies, and track their survival time.

**Play it:** https://aydan-a.github.io/Car-Game/

## Features
- Start screen with a driver name and a difficulty (Easy, Normal or Hard), with a preview of your car.
- Your name is written on the roof of your car.
- Player-controlled car with arrow keys, or by dragging on the road on a phone.
- Timer to track how long the player stays in the game.
- Red enemy cars spawn anywhere on the road and get faster every 10 seconds.
- Enemy cars are spaced out, so there is always a way around them.
- Collision detection to end the game.
- Game over message with your score and your best score.
- Records screen with a Top 10 and your recent games for each difficulty, saved in the browser with the name and date.
- Pause with `P`, `Esc` or the ⏸ button. The game also pauses when you switch tabs.

## Technologies Used
- **HTML**: For structuring the game area.
- **CSS / SCSS**: For styling the game elements (`carGame.scss` is the source of `carGame.css`).
- **JavaScript**: For game logic, including movement, collision detection, scoring and saved records.

## How to Play
1. Clone this repository:
   ```bash
   git clone https://github.com/Aydan-A/Car-Game.git
   ```
2. Open the `index.html` file in your browser.
3. Type your name, pick a difficulty and press **Start Race** (or `Enter`) to begin the game.
4. Use the arrow keys to move your car:
   - `ArrowUp`: Move up
   - `ArrowDown`: Move down
   - `ArrowLeft`: Move left
   - `ArrowRight`: Move right

   On a phone, drag your finger on the road and the car follows it.
5. Avoid colliding with the red cars to keep playing.
6. Your score (time in seconds) will be displayed at the top. **🏆 Records** shows your best and most recent games.

## Future Improvements
- Add sound effects and music.
- Add different enemy vehicles.

## License
This project is open-source and available under the MIT License.
