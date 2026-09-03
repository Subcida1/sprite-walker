# Twitch Chat Sprite Walker

A lightweight, self-hosted version of Stream Avatars for OBS. Viewers type `!join`, `!wave`, `!attack <user>`, and `!leave` in your Twitch chat (`subcidal`), bringing animated sprites to life on your overlay.

## Project Structure
```
sprite-walker/
├── server/
│   ├── index.js         # Express + tmi.js + WebSocket server
│   ├── commands.js      # Chat command parser
│   ├── characters.json  # Sprite sheet registry
│   └── config.js        # Channel name and port settings
├── overlay/
│   ├── index.html       # OBS Browser Source canvas page
│   ├── overlay.js       # WebSocket client & sprite state machine
│   └── style.css        # Transparent styling
└── assets/              # Sprite sheets folder
```

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. **OBS Setup**:
   - Add a new **Browser Source** in OBS.
   - URL: `http://localhost:3847`
   - Width / Height: Match your stream canvas (e.g., 1920x1080).
   - Leave "Shutdown source when not visible" unchecked if you want sprites to remain active.

## Twitch Commands
- `!join` — Spawns your character on screen.
- `!wave` — Makes your character wave.
- `!attack <username>` — Walks over and attacks another viewer's sprite.
- `!leave` — Despawns your character.
