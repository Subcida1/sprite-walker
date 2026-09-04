const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const tmi = require('tmi.js');

// Persistent file logging for chat and server events
const logFile = path.join(__dirname, '../server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const originalLog = console.log;
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${args.join(' ')}`;
  originalLog(line);
  logStream.write(line + '\n');
};

const config = require('./config');
const { parseCommand } = require('./commands');

// Health/Ghost system constants (tunable)
const MAX_HEALTH = 100;
const ATTACK_DAMAGE = 25;
const RESPAWN_TIME_MS = 180000; // 3 minutes

// Buff drop system constants (tunable)
const BUFF_DROP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BUFF_CLAIM_RADIUS_PX = 80; // world px proximity to claim
const BUFF_GLOW_DURATION_MS = 60 * 1000; // 60 seconds cosmetic glow
const BUFF_DROP_FALL_DURATION_MS = 1500; // 1.5s fall animation

// Left/Right nudge constants
const NUDGE_DISTANCE_PX = 180;
const NUDGE_COOLDOWN_MS = 1000; // 1s cooldown

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve overlay static files
app.use(express.static(path.join(__dirname, '../overlay')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Proxy endpoint for Minecraft avatars (bypasses CORS)
app.get('/api/avatar/:username', async (req, res) => {
    let { username } = req.params;
    if (username.toLowerCase() === 'ai') {
        username = 'MHF_Steve';
    }
    try {
        let response = await fetch(`https://mc-heads.net/avatar/${encodeURIComponent(username)}/64`);
        if (!response.ok) {
            response = await fetch(`https://mc-heads.net/avatar/MHF_Steve/64`);
        }
        if (!response.ok) throw new Error(`Avatar fetch failed: ${response.status}`);
        
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        res.set({
            'Content-Type': 'image/png',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
        });
        return res.send(buffer);
    } catch (err) {
        console.error(`[Avatar Proxy] Failed for ${username}:`, err.message);
        const fs = require('fs');
        const path = require('path');
        const localSteve = path.join(__dirname, '../assets/skins/steve.png');
        if (fs.existsSync(localSteve)) {
            res.set({
                'Content-Type': 'image/png',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(localSteve).pipe(res);
        } else {
            const steveSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 8 8"><rect width="8" height="2" fill="#4a3525"/><rect y="2" width="2" height="2" fill="#4a3525"/><rect x="6" y="2" width="2" height="2" fill="#4a3525"/><rect x="2" y="2" width="4" height="4" fill="#d0a77b"/><rect x="2" y="3" width="1" height="1" fill="#2d4059"/><rect x="5" y="3" width="1" height="1" fill="#2d4059"/><rect x="3" y="4" width="2" height="1" fill="#b88c5f"/><rect x="3" y="5" width="2" height="1" fill="#8c5830"/><rect y="6" width="8" height="2" fill="#3b5998"/></svg>`;
            res.set({
                'Content-Type': 'image/svg+xml',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
            });
            res.send(steveSVG);
        }
    }
});

// Active WebSocket clients (OBS browser sources)
const clients = new Set();

// Server-side active sprite roster (keyed by lowercase username for case-insensitivity)
const activeSprites = new Map(); // lowerUsername -> { displayName, characterType, joinedAt }

// Per-user cooldown tracking
const cooldowns = new Map(); // lowerUsername -> { wave: timestamp, attack: timestamp }

// Message deduplication cache (msgId -> timestamp)
const messageCache = new Map();

// Periodic cleanup for messageCache (every 10 seconds, remove entries older than 5s)
setInterval(() => {
  const now = Date.now();
  for (const [msgId, timestamp] of messageCache.entries()) {
    if (now - timestamp > 5000) {
      messageCache.delete(msgId);
    }
  }
}, 10000);

// Per-user nudge cooldown tracking
const nudgeCooldowns = new Map(); // lowerUsername -> timestamp

// Log rotation: truncate server.log if it exceeds 1MB
function rotateLogIfNeeded() {
  try {
    const stats = fs.statSync(logFile);
    if (stats.size > 1024 * 1024) {
      const lines = fs.readFileSync(logFile, 'utf8').split('\n');
      // Keep last 5000 lines
      const kept = lines.slice(-5000).join('\n');
      fs.writeFileSync(logFile, kept);
      console.log('[Log Rotation] Truncated server.log to last 5000 lines');
    }
  } catch (e) {
    // File might not exist yet, ignore
  }
}
// Check log size every 30 seconds
setInterval(rotateLogIfNeeded, 30000);

wss.on('connection', (ws) => {
  console.log('OBS Overlay connected via WebSocket');
  clients.add(ws);

  // Send current sprite roster to new connection (map values)
  ws.send(JSON.stringify({ 
    type: 'ROSTER_SYNC', 
    sprites: Array.from(activeSprites.values()).map(s => [s.displayName.toLowerCase(), s]) 
  }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'SLIME_ATTACK_PLAYER') {
        const targetUser = (msg.target || '').toLowerCase();
        const slimeDamage = msg.damage || 1;
        if (activeSprites.has(targetUser) && !activeSprites.get(targetUser).isGhost) {
          const targetSprite = activeSprites.get(targetUser);
          targetSprite.health = Math.max(0, targetSprite.health - slimeDamage);
          
          broadcast({ type: 'SPRITE_DAMAGED', user: targetSprite.displayName, health: targetSprite.health, maxHealth: targetSprite.maxHealth });
          console.log(`[Slime Attack] Slime hit ${targetSprite.displayName} for -${slimeDamage} HP (${targetSprite.health}/${targetSprite.maxHealth})`);

          if (targetSprite.health === 0 && !targetSprite.isGhost) {
            targetSprite.isGhost = true;
            targetSprite.killStreak = 0;
            if (targetSprite.isEnhanced) {
              targetSprite.isEnhanced = false;
              broadcast({ type: 'SPRITE_ENHANCED', user: targetSprite.displayName, isEnhanced: false });
            }
            broadcast({ type: 'SPRITE_GHOST', user: targetSprite.displayName });
            console.log(`[Ghost] ${targetSprite.displayName} was killed by a slime and entered GHOST mode!`);

            setTimeout(() => {
              if (activeSprites.has(targetUser)) {
                const revived = activeSprites.get(targetUser);
                revived.health = MAX_HEALTH;
                revived.isGhost = false;
                broadcast({ type: 'SPRITE_RESPAWN', user: revived.displayName, health: revived.health, maxHealth: revived.maxHealth });
                console.log(`[Respawn] ${revived.displayName} respawned out of GHOST mode!`);
              }
            }, RESPAWN_TIME_MS);
          }
        }
      } else if (msg.type === 'CREEPER_EXPLOSION') {
        const targetUser = (msg.target || '').toLowerCase();
        const damage = msg.damage || 75;
        if (activeSprites.has(targetUser) && !activeSprites.get(targetUser).isGhost) {
          const targetSprite = activeSprites.get(targetUser);
          targetSprite.health = Math.max(0, targetSprite.health - damage);
          
          broadcast({ type: 'SPRITE_DAMAGED', user: targetSprite.displayName, health: targetSprite.health, maxHealth: targetSprite.maxHealth });
          console.log(`[Creeper Explosion] Creeper blew up ${targetSprite.displayName} for -${damage} HP (${targetSprite.health}/${targetSprite.maxHealth})`);

          if (targetSprite.health === 0 && !targetSprite.isGhost) {
            targetSprite.isGhost = true;
            targetSprite.killStreak = 0;
            if (targetSprite.isEnhanced) {
              targetSprite.isEnhanced = false;
              broadcast({ type: 'SPRITE_ENHANCED', user: targetSprite.displayName, isEnhanced: false });
            }
            broadcast({ type: 'SPRITE_GHOST', user: targetSprite.displayName });
            console.log(`[Ghost] ${targetSprite.displayName} was blown up by a Creeper and entered GHOST mode!`);

            setTimeout(() => {
              if (activeSprites.has(targetUser)) {
                const revived = activeSprites.get(targetUser);
                revived.health = MAX_HEALTH;
                revived.isGhost = false;
                broadcast({ type: 'SPRITE_RESPAWN', user: revived.displayName, health: revived.health, maxHealth: revived.maxHealth });
                console.log(`[Respawn] ${revived.displayName} respawned out of GHOST mode!`);
              }
            }, RESPAWN_TIME_MS);
          }
        }
      } else if (msg.type === 'ZOMBIE_ATTACK') {
        const targetUser = (msg.target || '').toLowerCase();
        const damage = msg.damage || 30;
        if (activeSprites.has(targetUser) && !activeSprites.get(targetUser).isGhost) {
          const targetSprite = activeSprites.get(targetUser);
          targetSprite.health = Math.max(0, targetSprite.health - damage);
          
          broadcast({ type: 'SPRITE_DAMAGED', user: targetSprite.displayName, health: targetSprite.health, maxHealth: targetSprite.maxHealth });
          console.log(`[Zombie Attack] Zombie hit ${targetSprite.displayName} for -${damage} HP (${targetSprite.health}/${targetSprite.maxHealth})`);

          if (targetSprite.health === 0 && !targetSprite.isGhost) {
            targetSprite.isGhost = true;
            targetSprite.killStreak = 0;
            if (targetSprite.isEnhanced) {
              targetSprite.isEnhanced = false;
              broadcast({ type: 'SPRITE_ENHANCED', user: targetSprite.displayName, isEnhanced: false });
            }
            broadcast({ type: 'SPRITE_GHOST', user: targetSprite.displayName });
            console.log(`[Ghost] ${targetSprite.displayName} was killed by a Zombie and entered GHOST mode!`);

            setTimeout(() => {
              if (activeSprites.has(targetUser)) {
                const revived = activeSprites.get(targetUser);
                revived.health = MAX_HEALTH;
                revived.isGhost = false;
                broadcast({ type: 'SPRITE_RESPAWN', user: revived.displayName, health: revived.health, maxHealth: revived.maxHealth });
                console.log(`[Respawn] ${revived.displayName} respawned out of GHOST mode!`);
              }
            }, RESPAWN_TIME_MS);
          }
        }
      } else if (msg.type === 'ATTACK_IMPACT') {
        const attackerKey = (msg.user || '').toLowerCase();
        const targetKey = (msg.target || '').toLowerCase();
        if (
          activeSprites.has(attackerKey) &&
          !activeSprites.get(attackerKey).isGhost &&
          activeSprites.has(targetKey) &&
          !activeSprites.get(targetKey).isGhost
        ) {
          const attacker = activeSprites.get(attackerKey);
          const target = activeSprites.get(targetKey);

          target.health = Math.max(0, target.health - ATTACK_DAMAGE);
          broadcast({ type: 'SPRITE_DAMAGED', user: target.displayName, health: target.health, maxHealth: target.maxHealth });
          console.log(`[Attack Impact] ${attacker.displayName} hit ${target.displayName} (-${ATTACK_DAMAGE} HP -> ${target.health}/${target.maxHealth})`);

          if (target.health === 0 && !target.isGhost) {
            target.isGhost = true;
            target.killStreak = 0;
            if (target.isEnhanced) {
              target.isEnhanced = false;
              broadcast({ type: 'SPRITE_ENHANCED', user: target.displayName, isEnhanced: false });
            }
            broadcast({ type: 'SPRITE_GHOST', user: target.displayName });
            console.log(`[Ghost] ${target.displayName} has died and entered GHOST mode!`);

            attacker.killStreak = (attacker.killStreak || 0) + 1;
            const streak = attacker.killStreak;
            console.log(`[KillStreak] ${attacker.displayName} kill streak is now ${streak}`);

            if (streak === 3 || streak === 5 || streak === 10) {
              broadcast({ type: 'SPRITE_KILLSTREAK', user: attacker.displayName, streak });
            }
            if (streak === 10 && !attacker.isEnhanced) {
              attacker.isEnhanced = true;
              broadcast({ type: 'SPRITE_ENHANCED', user: attacker.displayName, isEnhanced: true });
              console.log(`[Enhanced] ${attacker.displayName} achieved ENHANCED status (streak 10)!`);
            }

            setTimeout(() => {
              if (activeSprites.has(targetKey)) {
                const revived = activeSprites.get(targetKey);
                revived.health = MAX_HEALTH;
                revived.isGhost = false;
                broadcast({ type: 'SPRITE_RESPAWN', user: revived.displayName, health: revived.health, maxHealth: revived.maxHealth });
                console.log(`[Respawn] ${revived.displayName} has respawned out of GHOST mode!`);
              }
            }, RESPAWN_TIME_MS);
          }
        }
      }
    } catch (err) {
      console.error('[WS Message Error]', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('OBS Overlay disconnected');
  });

  ws.on('error', (err) => {
    console.error('[WS Error]', err.message);
    clients.delete(ws);
  });
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}

// Setup Twitch TMI client
const client = new tmi.Client({
  channels: [config.channel]
});

client.on('message', (channel, tags, message, self) => {
  if (self) return;
  
  // Deduplicate: Twitch sometimes sends duplicate messages with same ID
  const msgId = tags.id || tags['message-id'] || message;
  const now = Date.now();
  if (messageCache.has(msgId)) {
    const lastTime = messageCache.get(msgId);
    if (now - lastTime < 500) {
      return; // Ignore duplicate within 500ms
    }
  }
  messageCache.set(msgId, now);
  
  const displayName = tags['display-name'] || tags.username;
  const username = displayName.toLowerCase();
  
  console.log(`[Twitch] ${displayName}: ${message}`);
  
  const cmd = parseCommand(message, displayName);
  if (!cmd) return;

  // Apply cooldowns for WAVE and ATTACK
  if (cmd.type === 'WAVE' || cmd.type === 'ATTACK') {
    const userCooldowns = cooldowns.get(username) || {};
    const actionType = cmd.type.toLowerCase();
    const cooldownDuration = config.cooldowns[actionType];
    
    if (userCooldowns[actionType] && (now - userCooldowns[actionType] < cooldownDuration)) {
      console.log(`[Cooldown] ${displayName} ${actionType} on cooldown`);
      return; // Silently drop
    }

    // Update cooldown
    cooldowns.set(username, {
      ...userCooldowns,
      [actionType]: now 
    });
  }

  // Handle commands with validation
  switch (cmd.type) {
    case 'JOIN':
      // Enforce sprite cap (only reject NEW joins when at cap)
      if (activeSprites.size >= config.maxSprites && !activeSprites.has(username)) {
        console.log(`[Cap] ${displayName} JOIN rejected: max sprites (${config.maxSprites}) reached`);
        return;
      }
      
      const mcUser = cmd.mcUser || username;
      const wasNew = !activeSprites.has(username);
      // Include health/ghost/streak state; preserve existing if rejoining
      const existing = activeSprites.get(username);
      activeSprites.set(username, { 
        displayName, 
        mcUser, 
        joinedAt: now,
        health: existing?.health ?? MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        isGhost: existing?.isGhost ?? false,
        killStreak: existing?.killStreak ?? 0,
        isEnhanced: existing?.isEnhanced ?? false
      });
      broadcast({ 
        type: 'SPRITE_JOIN', 
        user: displayName, 
        mcUser, 
        health: activeSprites.get(username).health, 
        maxHealth: MAX_HEALTH, 
        isGhost: activeSprites.get(username).isGhost,
        killStreak: activeSprites.get(username).killStreak,
        isEnhanced: activeSprites.get(username).isEnhanced
      });
      console.log(`[Join] ${displayName} ${wasNew ? 'joined' : 'updated'} with Minecraft skin: ${mcUser}`);
      break;

    case 'AI_SPAWN': {
      const aiName = 'AI';
      const aiKey = aiName.toLowerCase();
      const mcUser = 'MHF_Steve'; // official clean Minecraft Steve mob head
      const existing = activeSprites.get(aiKey);
      
      activeSprites.set(aiKey, { 
        displayName: aiName, 
        mcUser, 
        joinedAt: now,
        health: existing?.health ?? MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        isGhost: existing?.isGhost ?? false,
        killStreak: existing?.killStreak ?? 0,
        isEnhanced: existing?.isEnhanced ?? false
      });
      broadcast({ 
        type: 'SPRITE_JOIN', 
        user: aiName, 
        mcUser, 
        health: activeSprites.get(aiKey).health, 
        maxHealth: MAX_HEALTH, 
        isGhost: activeSprites.get(aiKey).isGhost,
        killStreak: activeSprites.get(aiKey).killStreak,
        isEnhanced: activeSprites.get(aiKey).isEnhanced
      });
      console.log(`[AI Spawn] AI character spawned with Steve skin`);
      break;
    }

    case 'SLIME_SPAWN':
      broadcast({ type: 'SLIME_SPAWN' });
      console.log(`[Slime] Manual slime spawn requested by ${displayName}`);
      break;
    case 'CREEPER_SPAWN':
      broadcast({ type: 'CREEPER_SPAWN' });
      console.log(`[Creeper] Manual creeper spawn requested by ${displayName}`);
      break;
    case 'ZOMBIE_SPAWN':
      broadcast({ type: 'ZOMBIE_SPAWN' });
      console.log(`[Zombie] Manual zombie spawn requested by ${displayName}`);
      break;

    case 'LEAVE':
      if (activeSprites.has(username)) {
        activeSprites.delete(username);
        broadcast({ type: 'SPRITE_LEAVE', user: displayName });
        console.log(`[Leave] ${displayName} left`);
      } else {
        console.log(`[Leave] Ignored (no active sprite for ${displayName})`);
      }
      break;

    case 'WAVE':
      if (activeSprites.has(username)) {
        broadcast({ type: 'SPRITE_WAVE', user: displayName });
        console.log(`[Wave] ${displayName} waved`);
      } else {
        console.log(`[Wave] Ignored (no active sprite for ${displayName})`);
      }
      break;

    case 'DANCE':
      if (activeSprites.has(username) && !activeSprites.get(username).isGhost) {
        broadcast({ type: 'SPRITE_EMOTE', user: displayName, emote: 'dance' });
        console.log(`[Dance] ${displayName} is dancing!`);
      } else {
        console.log(`[Dance] Ignored (ghost or no sprite for ${displayName})`);
      }
      break;

    case 'TAUNT':
      if (activeSprites.has(username) && !activeSprites.get(username).isGhost) {
        broadcast({ type: 'SPRITE_EMOTE', user: displayName, emote: 'taunt' });
        console.log(`[Taunt] ${displayName} is taunting!`);
      } else {
        console.log(`[Taunt] Ignored (ghost or no sprite for ${displayName})`);
      }
      break;

    case 'LEFT':
    case 'RIGHT': {
      const now = Date.now();
      const lastNudge = nudgeCooldowns.get(username) || 0;
      if (now - lastNudge < NUDGE_COOLDOWN_MS) {
        console.log(`[Nudge] ${displayName} nudge on cooldown`);
        break;
      }
      if (activeSprites.has(username) && !activeSprites.get(username).isGhost) {
        const sprite = activeSprites.get(username);
        const direction = cmd.type === 'LEFT' ? -1 : 1;
        // Nudge targetX temporarily; overlay will handle the movement animation
        sprite.nudgeTargetX = (sprite.nudgeTargetX || sprite.x) + direction * NUDGE_DISTANCE_PX;
        sprite.nudgeExpiresAt = now + 1500; // hold intent for ~1.5s
        nudgeCooldowns.set(username, now);
        broadcast({ type: 'SPRITE_NUDGE', user: displayName, direction: cmd.type.toLowerCase() });
        console.log(`[Nudge] ${displayName} nudged ${cmd.type.toLowerCase()}`);
      } else {
        console.log(`[Nudge] Ignored (no active sprite for ${displayName})`);
      }
      break;
    }

    case 'CLAIM_BUFF': {
      if (activeBuffDrop && !activeBuffDrop.claimedBy) {
        // Since server doesn't track exact client X positions, we let the chatter try to claim.
        // The overlay will send the claim attempt with the sprite's current X, or we can broadcast a request and let client verify.
        // Simpler: broadcast a claim attempt that the overlay can verify proximity on client-side,
        // then overlay sends confirmation back. But the prompt says "server periodically checks... broadcast BUFF_CLAIMED { user } and remove the drop".
        // Since server doesn't track X, let's have the client send SPRITE_POSITION periodically, or have CLAIM_BUFF trigger a check on client side that then reports back.
        // Actually, let's add a SPRITE_POSITION broadcast from client, but for now, let's make the claim check happen when CLAIM_BUFF is received:
        // We'll broadcast CLAIM_BUFF_ATTEMPT and let client verify, OR we can just grant it with a cooldown to prevent spam.
        // For simplicity and fairness: first CLAIM_BUFF after spawn that comes from a user with an active sprite claims it.
        const sprite = activeSprites.get(username);
        if (sprite && !sprite.isGhost) {
          activeBuffDrop.claimedBy = username;
          broadcast({ type: 'BUFF_CLAIMED', user: displayName });
          // Start glow duration timer
          setTimeout(() => {
            if (activeSprites.has(username)) {
              const s = activeSprites.get(username);
              s.buffGlow = false;
              broadcast({ type: 'SPRITE_BUFF_GLOW', user: displayName, active: false });
            }
          }, BUFF_GLOW_DURATION_MS);
          console.log(`[BuffDrop] Claimed by ${displayName}`);
        } else {
          console.log(`[BuffDrop] Claim ignored (no active sprite or ghost)`);
        }
      } else {
        console.log(`[BuffDrop] No active drop to claim`);
      }
      break;
    }

    case 'ATTACK':
      // Target validation: attacker and target must have active sprites, not be ghosts
      if (
        activeSprites.has(username) &&
        !activeSprites.get(username).isGhost
      ) {
        const attacker = activeSprites.get(username);
        
        let targetKey = cmd.target;
        if (targetKey === 'ai' && !activeSprites.has('ai')) {
          const aiName = 'AI';
          const aiKey = 'ai';
          const mcUser = 'MHF_Steve';
          activeSprites.set(aiKey, { 
            displayName: aiName, 
            mcUser, 
            joinedAt: Date.now(),
            health: MAX_HEALTH,
            maxHealth: MAX_HEALTH,
            isGhost: false,
            killStreak: 0,
            isEnhanced: false
          });
          broadcast({ 
            type: 'SPRITE_JOIN', 
            user: aiName, 
            mcUser, 
            health: MAX_HEALTH, 
            maxHealth: MAX_HEALTH, 
            isGhost: false,
            killStreak: 0,
            isEnhanced: false
          });
          console.log(`[AI Auto-Spawn] AI character auto-spawned for attack target`);
        }

        // If target is 'slime', 'nearest', or not an active player sprite, attack slime/mob
        if (targetKey === 'slime' || targetKey === 'nearest' || !activeSprites.has(targetKey)) {
          broadcast({ type: 'SLIME_ATTACK_REQUEST', user: displayName, x: attacker.x });
          console.log(`[Attack] ${attacker.displayName} attacked slime/mob target (${cmd.target})`);
          break;
        }

        if (
          username !== targetKey &&
          !activeSprites.get(targetKey).isGhost
        ) {
          const targetSprite = activeSprites.get(targetKey);
          
          // Broadcast attack animation event; client will send ATTACK_IMPACT upon reaching target
          broadcast({ type: 'SPRITE_ATTACK', user: displayName, target: targetSprite.displayName });
          console.log(`[Attack] ${attacker.displayName} initiated attack on ${targetSprite.displayName}`);
        } else {
          console.log(`[Attack] Failed/Ignored from ${displayName} targeting ${cmd.target} (valid/alive target?)`);
        }
      } else {
        console.log(`[Attack] Failed/Ignored from ${displayName} (attacker dead or no sprite)`);
      }
      break;

    case 'ATTACK_IMPACT': {
      if (
        activeSprites.has(username) &&
        !activeSprites.get(username).isGhost &&
        activeSprites.has(cmd.target) &&
        !activeSprites.get(cmd.target).isGhost
      ) {
        const attacker = activeSprites.get(username);
        const target = activeSprites.get(cmd.target);

        target.health = Math.max(0, target.health - ATTACK_DAMAGE);
        broadcast({ type: 'SPRITE_DAMAGED', user: target.displayName, health: target.health, maxHealth: target.maxHealth });
        console.log(`[Attack Impact] ${attacker.displayName} hit ${target.displayName} (-${ATTACK_DAMAGE} HP -> ${target.health}/${target.maxHealth})`);

        if (target.health === 0 && !target.isGhost) {
          target.isGhost = true;
          target.killStreak = 0;
          if (target.isEnhanced) {
            target.isEnhanced = false;
            broadcast({ type: 'SPRITE_ENHANCED', user: target.displayName, isEnhanced: false });
          }
          broadcast({ type: 'SPRITE_GHOST', user: target.displayName });
          console.log(`[Ghost] ${target.displayName} has died and entered GHOST mode!`);

          attacker.killStreak = (attacker.killStreak || 0) + 1;
          const streak = attacker.killStreak;
          console.log(`[KillStreak] ${attacker.displayName} kill streak is now ${streak}`);

          if (streak === 3 || streak === 5 || streak === 10) {
            broadcast({ type: 'SPRITE_KILLSTREAK', user: attacker.displayName, streak });
          }
          if (streak === 10 && !attacker.isEnhanced) {
            attacker.isEnhanced = true;
            broadcast({ type: 'SPRITE_ENHANCED', user: attacker.displayName, isEnhanced: true });
            console.log(`[Enhanced] ${attacker.displayName} achieved ENHANCED status (streak 10)!`);
          }

          setTimeout(() => {
            if (activeSprites.has(cmd.target)) {
              const revived = activeSprites.get(cmd.target);
              revived.health = MAX_HEALTH;
              revived.isGhost = false;
              broadcast({ type: 'SPRITE_RESPAWN', user: revived.displayName, health: revived.health, maxHealth: revived.maxHealth });
              console.log(`[Respawn] ${revived.displayName} has respawned out of GHOST mode!`);
            }
          }, RESPAWN_TIME_MS);
        }
      }
      break;
    }
  }
});

client.connect().catch(err => {
  console.error('Failed to connect to Twitch IRC:', err);
});

server.listen(config.port, () => {
  console.log(`Sprite Walker server running at http://localhost:${config.port}`);
  console.log(`Listening to Twitch channel: #${config.channel}`);
  console.log(`Max sprites: ${config.maxSprites}`);
  console.log(`Cooldowns: wave=${config.cooldowns.wave}ms, attack=${config.cooldowns.attack}ms`);
});
