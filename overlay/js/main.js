import { canvas, ctx } from './core/canvas.js';
import { state } from './core/state.js';
import { connectWS, spawnSlimeFromEdge, spawnCreeperFromEdge, spawnZombieFromEdge, spawnGhastFromEdge, spawnPhantomFromEdge } from './systems/websocket.js';
import { safeUpdate, safeDraw } from './core/errors.js';

// Surface Mob Wave Spawner (5-10 min intervals, pack of 1-3 mixed mobs)
function updateSurfaceMobSpawns() {
    state.surfaceMobSpawnTimer++;
    if (state.surfaceMobSpawnTimer >= state.nextSurfaceMobSpawnIn) {
        state.surfaceMobSpawnTimer = 0;
        state.nextSurfaceMobSpawnIn = 18000 + Math.floor(Math.random() * 18000); // 5 to 10 minutes at 60fps

        const totalActive = state.slimeMobs.length + state.creeperMobs.length + state.zombieMobs.length;
        if (totalActive < 8) {
            const packSize = Math.floor(Math.random() * 3) + 1; // 1 to 3 mobs
            console.log(`[Surface Spawner] Spawning wave of ${packSize} surface mobs`);
            for (let i = 0; i < packSize; i++) {
                const mobTypeRand = Math.random();
                if (mobTypeRand < 0.35) {
                    spawnSlimeFromEdge();
                } else if (mobTypeRand < 0.70) {
                    spawnCreeperFromEdge();
                } else {
                    spawnZombieFromEdge();
                }
            }
        }
    }
}

// Phantom Cycle & Ghast Auto-Spawn Timers
function updateWorldTimers() {
    // Ghast Auto-Spawn Timer (~45 min intervals)
    state.ghastSpawnTimer++;
    if (state.ghastSpawnTimer >= state.nextGhastSpawnIn) {
        state.ghastSpawnTimer = 0;
        state.nextGhastSpawnIn = Math.floor(Math.random() * 18000) + 162000; // ~45 min ± 5 min
        if (state.ghastMobs.length === 0) {
            spawnGhastFromEdge();
            console.log(`[Ghast] Auto-spawned on 45-min timer!`);
        }
    }

    // Phantom Cycle (10 min dormant, 5 min active)
    const PHANTOM_DORMANT_FRAMES = 10 * 60 * 60;
    const PHANTOM_ACTIVE_FRAMES = 5 * 60 * 60;

    if (!state.phantomActive) {
        state.phantomCycleFrames++;
        if (state.phantomCycleFrames >= PHANTOM_DORMANT_FRAMES) {
            state.phantomActive = true;
            state.phantomActiveFramesLeft = PHANTOM_ACTIVE_FRAMES;
            state.phantomCycleFrames = 0;
            console.log(`[Phantom Cycle] Night phase active! Phantoms descending for 5 minutes.`);
            for (let i = 0; i < 3; i++) {
                spawnPhantomFromEdge();
            }
        }
    } else {
        state.phantomActiveFramesLeft--;
        if (state.phantomActiveFramesLeft <= 0) {
            state.phantomActive = false;
            state.phantomCycleFrames = 0;
            console.log(`[Phantom Cycle] Morning arrived. Phantoms retreating.`);
            for (const p of state.phantomMobs) {
                p.exited = true;
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update global world timers & spawners
    updateSurfaceMobSpawns();
    updateWorldTimers();

    // 1. Slime Mobs
    for (let i = state.slimeMobs.length - 1; i >= 0; i--) {
        const slime = state.slimeMobs[i];
        safeUpdate(() => slime.update(state.slimeMobs, state.sprites, state.wsInstance), 'SlimeMob');
        safeDraw(slime, ctx, 'SlimeMob');
        if (slime.health <= 0 || slime.exited) {
            state.slimeMobs.splice(i, 1);
        }
    }

    // 2. Creeper Mobs
    for (let i = state.creeperMobs.length - 1; i >= 0; i--) {
        const creeper = state.creeperMobs[i];
        safeUpdate(() => creeper.update(state.slimeMobs, state.creeperMobs, state.sprites, state.wsInstance), 'CreeperMob');
        safeDraw(creeper, ctx, 'CreeperMob');
        if (creeper.health <= 0 || creeper.exited) {
            state.creeperMobs.splice(i, 1);
        }
    }

    // 3. Creeper Explosions
    for (let i = state.creeperExplosions.length - 1; i >= 0; i--) {
        const exp = state.creeperExplosions[i];
        exp.update();
        exp.draw(ctx);
        if (exp.isDead()) {
            state.creeperExplosions.splice(i, 1);
        }
    }

    // 4. Zombie Mobs
    for (let i = state.zombieMobs.length - 1; i >= 0; i--) {
        const z = state.zombieMobs[i];
        safeUpdate(() => z.update(state.slimeMobs, state.creeperMobs, state.zombieMobs, state.sprites, state.wsInstance), 'ZombieMob');
        safeDraw(z, ctx, 'ZombieMob');
        if (z.health <= 0 || z.exited) {
            state.zombieMobs.splice(i, 1);
        }
    }

    // 5. Ghast Mobs
    for (let i = state.ghastMobs.length - 1; i >= 0; i--) {
        const g = state.ghastMobs[i];
        safeUpdate(() => g.update(state.sprites, state.ghastFireballs, state.wsInstance), 'GhastMob');
        safeDraw(g, ctx, 'GhastMob');
        if (g.health <= 0 || g.exited) {
            state.ghastMobs.splice(i, 1);
        }
    }

    // 6. Ghast Fireballs
    for (let i = state.ghastFireballs.length - 1; i >= 0; i--) {
        const fb = state.ghastFireballs[i];
        fb.update(state.sprites, state.wsInstance);
        fb.draw(ctx);
        if (!fb.exited) {
            // keep alive
        } else {
            state.ghastFireballs.splice(i, 1);
        }
    }

    // 7. Phantom Mobs
    for (let i = state.phantomMobs.length - 1; i >= 0; i--) {
        const p = state.phantomMobs[i];
        safeUpdate(() => p.update(state.sprites, state.wsInstance), 'PhantomMob');
        safeDraw(p, ctx, 'PhantomMob');
        if (p.health <= 0 || p.exited) {
            state.phantomMobs.splice(i, 1);
        }
    }

    // 8. Player Sprites (Bottom Quarter)
    for (const [key, sprite] of state.sprites) {
        safeUpdate(() => sprite.update(), `Sprite:${sprite.username}`);
        safeDraw(sprite, ctx, `Sprite:${sprite.username}`);
        if (sprite.exited) {
            state.sprites.delete(key);
        }
    }

    // 9. Blood Particles
    for (let i = state.bloodParticles.length - 1; i >= 0; i--) {
        const p = state.bloodParticles[i];
        if (p.update()) {
            p.draw(ctx);
        } else {
            state.bloodParticles.splice(i, 1);
        }
    }

    // 10. Ghost Wispy Particles
    for (let i = state.ghostParticles.length - 1; i >= 0; i--) {
        const p = state.ghostParticles[i];
        if (p.update()) {
            p.draw(ctx);
        } else {
            state.ghostParticles.splice(i, 1);
        }
    }

    // 11. Diamond Drop Particles
    for (let i = state.diamondDrops.length - 1; i >= 0; i--) {
        const p = state.diamondDrops[i];
        if (p.update(canvas.height)) {
            p.draw(ctx);
        } else {
            state.diamondDrops.splice(i, 1);
            if (p === state.activeDiamondDrop) state.activeDiamondDrop = null;
        }
    }

    requestAnimationFrame(animate);
}

connectWS();
animate();
