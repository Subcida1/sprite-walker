import { state } from '../core/state.js';
import { Sprite } from '../entities/sprite.js';
import { SlimeMob } from '../entities/slime.js';
import { CreeperMob } from '../entities/creeper.js';
import { ZombieMob } from '../entities/zombie.js';
import { GhastMob, GhastFireball } from '../entities/ghast.js';
import { PhantomMob } from '../entities/phantom.js';
import { MinecraftDiamondDrop } from '../particles/diamond.js';
import { canvas } from '../core/canvas.js';

export function connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    state.wsInstance = ws;

    ws.onopen = () => {
        console.log('[WebSocket] Connected to server overlay bridge');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('[WebSocket] Failed to parse message:', e);
        }
    };

    ws.onclose = () => {
        console.warn('[WebSocket] Disconnected. Reconnecting in 3s...');
        setTimeout(connectWS, 3000);
    };

    ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
    };
}

function handleMessage(data) {
    const { type, user, mcUser, health, maxHealth, isGhost, killStreak, isEnhanced, x, direction } = data;

    if (type === 'SYNC_STATE' && data.sprites) {
        state.sprites.clear();
        for (const [uname, sData] of Object.entries(data.sprites)) {
            const sprite = new Sprite(
                sData.username,
                sData.mcUser,
                sData.health,
                sData.maxHealth,
                sData.isGhost,
                sData.killStreak,
                sData.isEnhanced
            );
            state.sprites.set(uname.toLowerCase(), sprite);
        }
    } else if (type === 'SPRITE_SPAWN' || type === 'SPRITE_JOIN') {
        const key = user.toLowerCase();
        if (!state.sprites.has(key)) {
            const sprite = new Sprite(user, mcUser, health, maxHealth, isGhost, killStreak, isEnhanced);
            state.sprites.set(key, sprite);
            console.log(`[Client] Sprite spawned for ${user} (MC: ${mcUser})`);
        }
    } else if (type === 'SPRITE_UPDATE' || type === 'SPRITE_STATE') {
        const key = user.toLowerCase();
        if (state.sprites.has(key)) {
            const sprite = state.sprites.get(key);
            sprite.pendingHealth = health !== undefined ? health : sprite.health;
            sprite.pendingMaxHealth = maxHealth !== undefined ? maxHealth : sprite.maxHealth;
            if (isGhost !== undefined) sprite.pendingGhost = isGhost;
            if (killStreak !== undefined) sprite.killStreak = killStreak;
            if (isEnhanced !== undefined) sprite.isEnhanced = isEnhanced;
        } else {
            const sprite = new Sprite(user, mcUser, health, maxHealth, isGhost, killStreak, isEnhanced);
            state.sprites.set(key, sprite);
        }
    } else if (type === 'SPRITE_LEAVE' || type === 'SPRITE_REMOVE') {
        const key = user.toLowerCase();
        if (state.sprites.has(key)) {
            const sprite = state.sprites.get(key);
            sprite.state = 'exiting';
            console.log(`[Client] Sprite exiting for ${user}`);
        }
    } else if (type === 'SPRITE_NUDGE') {
        const key = user.toLowerCase();
        if (state.sprites.has(key)) {
            state.sprites.get(key).nudge(direction);
        }
    } else if (type === 'BUFF_DROP_SPAWN' || type === 'DIAMOND_DROP_SPAWN') {
        state.activeDiamondDrop = new MinecraftDiamondDrop(x || (Math.random() * (canvas.width - 200) + 100), canvas.width, canvas.height);
        state.diamondDrops.push(state.activeDiamondDrop);
        console.log(`[Client] Minecraft Diamond drop spawned at x=${x}`);
    } else if (type === 'BUFF_CLAIMED' || type === 'DIAMOND_CLAIMED') {
        if (state.activeDiamondDrop) {
            state.activeDiamondDrop.claimed = true;
            state.activeDiamondDrop.claimTime = Date.now();
        }
        const key = user ? user.toLowerCase() : '';
        if (state.sprites.has(key)) {
            state.sprites.get(key).setBuffGlow(true);
            console.log(`[Client] Diamond claimed by ${user}`);
        }
    } else if (type === 'SLIME_SPAWN') {
        spawnSlimeFromEdge();
        console.log(`[Slime] Manual !slime spawn triggered`);
    } else if (type === 'CREEPER_SPAWN') {
        spawnCreeperFromEdge();
        console.log(`[Creeper] Manual !creeper spawn triggered`);
    } else if (type === 'ZOMBIE_SPAWN') {
        spawnZombieFromEdge();
        console.log(`[Zombie] Manual !zombie spawn triggered`);
    } else if (type === 'GHAST_SPAWN') {
        spawnGhastFromEdge();
        console.log(`[Ghast] Manual !ghast spawn triggered`);
    } else if (type === 'PHANTOM_SPAWN') {
        spawnPhantomFromEdge();
        console.log(`[Phantom] Manual !phantom spawn triggered`);
    } else if (type === 'SLEEP') {
        state.phantomActive = false;
        state.phantomCycleFrames = 0;
        state.phantomActiveFramesLeft = 0;
        for (const p of state.phantomMobs) {
            p.exited = true;
        }
        state.phantomMobs.length = 0;
        console.log(`[Sleep] Phantoms cleared and cycle reset via chat command`);
    }
}

export function spawnSlimeFromEdge() {
    if (state.slimeMobs.length >= 8) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -40 : canvas.width + 40;
    const tierRand = Math.random();
    const tier = tierRand < 0.5 ? 'big' : (tierRand < 0.85 ? 'medium' : 'small');
    const slime = new SlimeMob(startX, canvas.height - 25, tier);
    slime.enterDirection = fromLeft ? 'right' : 'left';
    state.slimeMobs.push(slime);
}

export function spawnCreeperFromEdge() {
    if (state.creeperMobs.length >= 6) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -50 : canvas.width + 50;
    const creeper = new CreeperMob(startX, canvas.height - 25);
    state.creeperMobs.push(creeper);
}

export function spawnZombieFromEdge() {
    if (state.zombieMobs.length >= 6) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -50 : canvas.width + 50;
    const zombie = new ZombieMob(startX, canvas.height - 25);
    state.zombieMobs.push(zombie);
}

export function spawnGhastFromEdge() {
    if (state.ghastMobs.length >= 1) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -100 : canvas.width + 100;
    const ghast = new GhastMob(startX, canvas.height - 180, fromLeft);
    state.ghastMobs.push(ghast);
}

export function spawnPhantomFromEdge() {
    if (state.phantomMobs.length >= 5) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -60 : canvas.width + 60;
    const phantom = new PhantomMob(startX, canvas.height - 140);
    state.phantomMobs.push(phantom);
}
