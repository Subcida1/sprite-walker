// Overlay Client: Minecraft Slime-Hop Roster & Bottom Quarter restriction

const canvas = document.getElementById('overlayCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Preload avatar image cache: mcUsername -> Image object (via local proxy to avoid CORS)
const skinCache = {};
function getAvatarImage(mcUser) {
    const key = mcUser ? mcUser.toLowerCase() : 'steve';
    if (!skinCache[key]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // Add cache buster query parameter to prevent stale browser caching
        img.src = `/api/avatar/${encodeURIComponent(key)}?v=2`;
        img.onerror = () => {
            console.warn(`[Avatar] Failed to load skin for ${key}, using procedural fallback`);
        };
        skinCache[key] = img;
    }
    return skinCache[key];
}

// Active sprites map: username -> Sprite object
const sprites = new Map();

// Blood splatter particles
const bloodParticles = [];
class BloodParticle {
    constructor(x, y, color = '#f44336') {
        this.x = x + (Math.random() - 0.5) * 30;
        this.y = y + (Math.random() - 0.5) * 20;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -Math.random() * 3 - 1;
        this.life = 1.0;
        this.size = Math.random() * 3 + 2;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.15; // gravity
        this.life -= 0.025; // ~0.5s at 60fps
        return this.life > 0;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Ghost wispy wisp particle - smoky wisps from sides (gradient-based soft smoke)
const ghostParticles = [];
class GhostParticle {
    constructor(x, y, halfSize) {
        // Spawn from left or right side of the square, with some vertical variance
        const side = Math.random() < 0.5 ? -1 : 1;
        this.x = x + side * (halfSize + Math.random() * 12); // just outside the side edges
        this.y = y + (Math.random() - 0.5) * halfSize * 1.5; // vertical spread along the side
        this.vx = side * (Math.random() * 0.3 + 0.1); // drift outward from the side
        this.vy = -Math.random() * 0.6 - 0.2; // slow upward drift
        this.life = 1.0;
        this.size = Math.random() * 8 + 6; // larger for smoke puffs
        this.squish = Math.random() * 0.6 + 0.4; // horizontal stretch
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.985; // gentle air resistance
        this.vy -= 0.006; // slight upward acceleration (hot air rises)
        this.life -= 0.008; // very slow fade for smoke
        this.rotation += this.rotationSpeed;
        this.size += 0.15; // smoke expands as it rises
        return this.life > 0;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.life * 0.25;
        
        // Soft radial gradient for true smoke look
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grad.addColorStop(0, 'rgba(160, 175, 190, 0.4)');
        grad.addColorStop(0.4, 'rgba(140, 160, 180, 0.2)');
        grad.addColorStop(1, 'rgba(120, 140, 160, 0)');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        // Elongated ellipse for smoke streaks
        ctx.ellipse(0, 0, this.size * this.squish, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }
}

// Buff drop falling particle
const buffDropParticles = [];
let activeBuffDrop = null; // { x, y, spawnTime, fallProgress, claimed }

class BuffDropParticle {
    constructor(x) {
        this.targetX = x;
        this.x = x;
        this.y = -30; // start above screen
        this.groundY = canvas.height - 50;
        this.spawnTime = Date.now();
        this.claimed = false;
        this.claimTime = 0;
        this.life = 1.0;
    }
    update() {
        this.groundY = canvas.height - 50;
        if (this.claimed) {
            // Shrink and fade after claim
            this.life = Math.max(0, (this.claimTime + 500 - Date.now()) / 500);
            return this.life > 0;
        }
        const elapsed = Date.now() - this.spawnTime;
        const fallDuration = 1200; // 1.2s fall
        const progress = Math.min(1, elapsed / fallDuration);
        // Ease out bounce
        const eased = 1 - Math.pow(1 - progress, 3);
        this.y = -30 + eased * (this.groundY - (-30));
        
        // Once landed on the floor, gently bob up and down
        if (progress >= 1) {
            this.y = this.groundY + Math.sin(Date.now() * 0.008) * 6;
        }
        return true;
    }
    draw(ctx) {
        ctx.save();
        if (this.claimed) {
            ctx.globalAlpha = Math.max(0, (this.claimTime + 500 - Date.now()) / 500);
        }
        
        // Magical RGB shimmering color cycle
        const time = Date.now();
        const hue = (time * 0.15) % 360;
        // Gentle pulse (less dramatic flash)
        const pulse = Math.sin(time * 0.008) * 0.12 + 0.9;
        const size = 16 * pulse;
        
        // Translucent glassy center diamond (soft magical glow behind)
        const glassFill = `hsla(${hue}, 90%, 65%, 0.45)`;
        const glassBorder = `hsla(${(hue + 90) % 360}, 100%, 80%, 0.9)`;

        // Soft outer radial glow (subtle, translucent)
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, size * 1.6);
        gradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.35)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size * 1.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw a translucent glassy diamond center
        drawDiamond(ctx, this.x, this.y, size);
        ctx.fillStyle = glassFill;
        ctx.fill();
        ctx.strokeStyle = glassBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Small glass highlight facet (upper-left)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(this.x - size * 0.25, this.y - size * 0.3, size * 0.18, 0, Math.PI * 2);
        ctx.fill();

        // Orbit translucent glassy diamonds (side sparkles)
        for (let i = 0; i < 4; i++) {
            const angle = (time * 0.003) + (i * Math.PI / 2);
            const orbitDist = size * 1.5;
            const sx = this.x + Math.cos(angle) * orbitDist;
            const sy = this.y + Math.sin(angle) * orbitDist;
            const sparkleHue = (hue + 120) % 360;
            drawDiamond(ctx, sx, sy, 3.5);
            ctx.fillStyle = `hsla(${sparkleHue}, 100%, 78%, 0.55)`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

class Sprite {
    constructor(username, mcUser, health = 100, maxHealth = 100, isGhost = false, killStreak = 0, isEnhanced = false) {
        this.username = username;
        this.mcUser = mcUser || username;
        
        // Health / Ghost state
        this.health = health;
        this.maxHealth = maxHealth;
        this.pendingHealth = health;
        this.pendingMaxHealth = maxHealth;
        this.isGhost = isGhost;
        this.pendingGhost = false; // deferred ghost transition until hit animation lands
        
        // Kill streak / Enhanced state
        this.killStreak = killStreak;
        this.isEnhanced = isEnhanced;
        this.killStreakTimer = 0;
        
        // Buff glow state
        this.buffGlow = false;
        this.buffGlowTimer = 0;
        
        // Hurt phrase variation
        this.hurtPhrase = '💥 Ouch!';

        // Ghost ascension animation
        this.ascending = false;
        this.ascensionStartTime = 0;
        this.ascensionDuration = 3500; // 3.5 seconds
        this.ascensionStartY = 0;
        this.ascensionTargetY = 0;

        // Nudge state
        this.nudgeTargetX = null;
        this.nudgeExpiresAt = 0;
        
        // Bottom quarter Y range
        this.groundY = canvas.height - 60;
        
        // Deterministic unique screen position based on username hash (prevents clumping)
        let hash = 0;
        for (let i = 0; i < this.username.length; i++) {
            hash = (hash * 31 + this.username.charCodeAt(i)) % 1000;
        }
        const userFactor = hash / 1000; // 0 to 0.999
        this.targetX = 60 + userFactor * (canvas.width - 120);
        // Small random jitter so even similar hashes don't perfectly align
        this.targetX += Math.random() * 60 - 30;
        this.targetX = Math.max(50, Math.min(canvas.width - 50, this.targetX));
        
        this.enterDirection = this.targetX < canvas.width / 2 ? 'left' : 'right';
        this.x = this.enterDirection === 'left' ? -40 : canvas.width + 40;
        this.y = this.groundY;
        
        this.startX = this.x;
        this.totalDist = Math.abs(this.targetX - this.startX);
        const desiredHopLength = 60;
        this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
        // Slower entrance walk-in: 4-5 seconds to traverse screen
        this.speed = 1.0; // reduced from 1.8 for slower, smoother entrance
        this.state = 'entering'; // entering, idle, hopping, waving, attacking, returning, hurt, exiting
        this.stateTimer = 0;
        this.attackTarget = null;
        this.originalX = this.targetX;

        this.facingRight = true;
        this.hitEffectTimer = 0;
        this.enterDirection = 'right'; // 'left' or 'right' for walk-in animation

        // Ghost wandering state
        this.ghostTargetX = null;
        this.ghostWaitTimer = 0;

        // Smooth squash/stretch values (decoupled from instantaneous height)
        this.currentSquashX = 1;
        this.currentSquashY = 1;
    }

    update() {
        const bottomMinY = canvas.height * 0.82;
        const bottomMaxY = canvas.height - 25; // Floor is now lower down
        this.groundY = bottomMaxY;

        // Handle entrance animation (hop in from edge of screen)
        if (this.state === 'entering') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
                const traveled = Math.abs(this.x - this.startX);
                const progress = Math.min(1, traveled / this.totalDist);
                this.y = this.groundY - Math.abs(Math.sin(progress * Math.PI * this.hopCount)) * 14;
            } else {
                this.x = this.targetX;
                this.y = this.groundY;
                this.state = 'idle';
            }
            if (this.hitEffectTimer > 0) this.hitEffectTimer--;
            return;
        }

        // Handle exit animation (hop off screen edge)
        if (this.state === 'exiting') {
            const edgeX = this.enterDirection === 'right' ? canvas.width + 60 : -60;
            const dx = edgeX - this.x;
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(1.8, Math.abs(dx)); // match standard walking speed for smooth exit
                const traveled = Math.abs(this.x - this.startX);
                const progress = Math.min(1, traveled / this.totalDist);
                this.y = this.groundY - Math.abs(Math.sin(progress * Math.PI * this.hopCount)) * 14;
            } else {
                this.exited = true;
            }
            if (this.hitEffectTimer > 0) this.hitEffectTimer--;
            return;
        }

        // WoW Classic Ghost: completely smooth floating glide with zero jumping/bouncing
        if (this.isGhost) {
            const ghostHoverY = bottomMaxY - 40; // float ~40px above ground
            if (this.ascending) {
                const elapsed = Date.now() - this.ascensionStartTime;
                const progress = Math.min(1, elapsed / this.ascensionDuration);
                // Smooth ease out cubic for slow, majestic rising over 3.5s
                const eased = 1 - Math.pow(1 - progress, 3);
                this.y = this.ascensionStartY + (ghostHoverY - this.ascensionStartY) * eased;
                
                if (progress >= 1) {
                    this.ascending = false;
                }
            } else {
                // Ghost floating wander with smooth pauses between movements (wrapped)
                if (!this.ghostTargetX) {
                    // Pick target anywhere in continuous wrapped space
                    this.ghostTargetX = Math.random() * (canvas.width + 200) - 100;
                    this.ghostWaitTimer = 0;
                }

                if (this.ghostWaitTimer > 0) {
                    this.ghostWaitTimer--;
                } else {
                    const dx = this.wrappedDiff(this.ghostTargetX, this.x);
                    if (Math.abs(dx) > 1.5) {
                        this.facingRight = dx > 0;
                        this.x += Math.sign(dx) * Math.min(1.1, Math.abs(dx)); // gentle float speed
                        this.x = this.wrapX(this.x);
                    } else {
                        // Reached target: wait 3 to 7 seconds before picking a new distant target
                        this.ghostWaitTimer = 180 + Math.floor(Math.random() * 240);
                        this.ghostTargetX = Math.random() * (canvas.width + 200) - 100;
                    }
                }
                // Smooth ethereal sine bob at fixed float height
                this.y = ghostHoverY + Math.sin(Date.now() * 0.002 + this.x * 0.015) * 6;
            }
            
            this.x = (this.x + canvas.width) % canvas.width;

            // Keep squash/stretch neutral for ghost
            this.currentSquashX = 1;
            this.currentSquashY = 1;
            if (this.hitEffectTimer > 0) this.hitEffectTimer--;
            return; // skip normal hopping/walking logic entirely
        }

        if (this.state === 'idle') {
            // Random chance to start hopping to a new position ANYWHERE (including off-screen for wrap)
            if (Math.random() < 0.015) {
                this.startX = this.x;
                // Pick target anywhere in continuous wrapped space
                this.targetX = Math.random() * (canvas.width + 200) - 100; // -100 to canvas.width+100
                this.totalDist = this.wrappedDist(this.startX, this.targetX);
                const desiredHopLength = 60; // px per bounce
                this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                this.state = 'hopping';
            }
        } else if (this.state === 'hopping') {
            // Move toward target using wrapped direction (shortest path across screen edges)
            const dx = this.wrappedDiff(this.targetX, this.x);
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
                // Wrap position continuously
                this.x = this.wrapX(this.x);
                // Progress along wrapped path
                const traveled = this.wrappedDist(this.startX, this.x);
                const progress = Math.min(1, traveled / this.totalDist);
                this.y = this.groundY - Math.abs(Math.sin(progress * Math.PI * this.hopCount)) * 14;
            } else {
                this.x = this.targetX;
                this.y = this.groundY;
                this.state = 'idle';
            }
        } else if (this.state === 'waving') {
            this.stateTimer--;
            const waveProgress = (60 - this.stateTimer) / 60; // 0 to 1 over 1s
            this.y = this.groundY - Math.abs(Math.sin(waveProgress * Math.PI * 2)) * 10; // two gentle hops
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.y = this.groundY;
            }
        } else if (this.state === 'attacking') {
            const targetSprite = sprites.get(this.attackTarget);
            if (targetSprite) {
                const dx = this.wrappedDiff(targetSprite.x, this.x);
                this.facingRight = dx > 0;

                if (Math.abs(dx) < 5) {
                    // Arrived at target — send impact confirmation to server, then start returning.
                    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                        wsInstance.send(JSON.stringify({
                            type: 'ATTACK_IMPACT',
                            user: this.username,
                            target: this.attackTarget
                        }));
                    }
                    this.startX = this.x;
                    this.targetX = this.originalX;
                    this.totalDist = this.wrappedDist(this.startX, this.targetX);
                    const desiredHopLength = 60;
                    this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                    this.state = 'returning';
                } else {
                    this.x += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * 2);
                    const hopCycle = 55;
                    const traveled = this.wrappedDist(this.startX, this.x);
                    this.y = this.groundY - Math.abs(Math.sin((traveled / hopCycle) * Math.PI)) * 18;
                }
            } else {
                this.state = 'idle';
                this.y = this.groundY;
            }
        } else if (this.state === 'attacking_slime') {
            const slime = this.attackTargetSlime;
            if (slime && slime.health > 0) {
                // Keep targetX locked to slime's current position
                this.targetX = slime.x;
                const dx = this.wrappedDiff(this.targetX, this.x);
                this.facingRight = dx > 0;

                if (Math.abs(dx) > 2.0) {
                    this.x += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * 2);
                    const hopCycle = 55;
                    const traveled = this.wrappedDist(this.startX, this.x);
                    this.y = this.groundY - Math.abs(Math.sin((traveled / hopCycle) * Math.PI)) * 18;
                } else {
                    // EXACT MOMENT OF IMPACT — deal damage and return!
                    slime.hurt(2);
                    this.startX = this.x;
                    this.targetX = this.originalX;
                    this.totalDist = this.wrappedDist(this.startX, this.targetX);
                    const desiredHopLength = 60;
                    this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                    this.state = 'returning';
                }
            } else {
                this.startX = this.x;
                this.targetX = this.originalX;
                this.totalDist = this.wrappedDist(this.startX, this.targetX);
                const desiredHopLength = 60;
                this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                this.state = 'returning';
            }
        } else if (this.state === 'hurt') {
            this.stateTimer--;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.y = this.groundY;
            }
        } else if (this.state === 'fleeing') {
            const dx = this.wrappedDiff(this.targetX, this.x);
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 2.0) {
                this.x += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * 3.2);
                const hopCycle = 38;
                const traveled = this.wrappedDist(this.startX, this.x);
                this.y = this.groundY - Math.abs(Math.sin((traveled / hopCycle) * Math.PI)) * 16;
            } else {
                this.x = this.targetX;
                this.y = this.groundY;
                this.state = 'idle';
                this.attacker = null;
            }
        } else if (this.state === 'returning') {
            const dx = this.wrappedDiff(this.targetX, this.x);
            if (Math.abs(dx) > 1.5) {
                this.facingRight = dx > 0;
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
                const hopCycle = 55;
                const traveled = this.wrappedDist(this.startX, this.x);
                this.y = this.groundY - Math.abs(Math.sin((traveled / hopCycle) * Math.PI)) * 14;
            } else {
                this.x = this.targetX;
                this.y = this.groundY;
                this.state = 'idle';
            }
        } else if (this.state === 'falling') {
            // Smooth gravity fall from hover height to ground
            this.fallVelocity += 0.6; // gravity acceleration
            this.y += this.fallVelocity;
            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.state = 'idle';
                this.fallVelocity = 0;
            }
        } else if (this.state === 'dancing') {
            this.stateTimer--;
            const danceProgress = (120 - this.stateTimer) / 10; // faster oscillation over 2s
            // Faster, smaller bounce + side wiggle to read as dancing
            this.y = this.groundY - Math.abs(Math.sin(danceProgress * Math.PI * 4)) * 12;
            this.x += Math.sin(danceProgress * Math.PI) * 0.8; // side wiggle
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.y = this.groundY;
            }
        } else if (this.state === 'taunting') {
            this.stateTimer--;
            // Bobbing + forward lean so it reads differently from a hop
            this.y = this.groundY - Math.abs(Math.sin(this.stateTimer * 0.5)) * 8;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.y = this.groundY;
            }
        }

        // Continuous wrapping platform (screen edge wrap)
        if (this.state !== 'entering' && this.state !== 'exiting') {
            const oldX = this.x;
            this.x = this.wrapX(this.x);
            const deltaX = this.x - oldX;
            if (deltaX !== 0) {
                if (this.startX !== undefined) this.startX += deltaX;
                if (this.targetX !== undefined) this.targetX += deltaX;
                if (this.originalX !== undefined) this.originalX += deltaX;
            }
        }
        this.y = Math.max(bottomMinY, Math.min(bottomMaxY, this.y));

        // WoW Classic Ghost floating hover effect (~40px above ground)
        if (this.isGhost) {
            const ghostHoverY = bottomMaxY - 40;
            this.y = ghostHoverY + Math.sin(Date.now() * 0.003 + this.x) * 6;
        }

        // Handle nudge intent (temporary targetX override from !left/!right)
        const now = Date.now();
        if (this.nudgeTargetX !== null && now < this.nudgeExpiresAt) {
            // Temporarily override targetX for this frame to nudge toward target
            this.targetX = this.nudgeTargetX;
            // Force a hop toward the nudge target if idle
            if (this.state === 'idle') {
                this.startX = this.x;
                this.totalDist = Math.max(1, Math.abs(this.targetX - this.startX));
                const desiredHopLength = 60;
                this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                this.state = 'hopping';
            }
        } else if (this.nudgeTargetX !== null) {
            // Nudge expired
            this.nudgeTargetX = null;
        }

        // Smooth squash/stretch easing (tunable: easeSpeed)
        const heightOffset = this.groundY - this.y; // 0 on ground, positive in air
        const targetSquashX = 1 - (heightOffset / 100);
        const targetSquashY = 1 + (heightOffset / 100);
        const easeSpeed = 0.2; // higher = snappier, lower = more fade
        this.currentSquashX += (targetSquashX - this.currentSquashX) * easeSpeed;
        this.currentSquashY += (targetSquashY - this.currentSquashY) * easeSpeed;

        if (this.hitEffectTimer > 0) {
            this.hitEffectTimer--;
        }

        // Buff glow timer
        if (this.buffGlow && this.buffGlowTimer > 0) {
            this.buffGlowTimer--;
            if (this.buffGlowTimer <= 0) {
                this.buffGlow = false;
            }
        }

        // Spawn wispy ghost wisp particles continuously while ghosted - from the sides
        if (this.isGhost && Math.random() < 0.25) {
            ghostParticles.push(new GhostParticle(this.x, this.y - 26, 26));
        }
    }

    wave() {
        this.state = 'waving';
        this.stateTimer = 60; // 1 second
    }

    attack(targetUsername) {
        if (!sprites.has(targetUsername) || targetUsername === this.username) return;
        this.originalX = this.x;
        this.startX = this.x;
        const targetSprite = sprites.get(targetUsername);
        this.targetX = targetSprite.x;
        this.totalDist = Math.max(1, Math.abs(this.targetX - this.startX));
        const desiredHopLength = 60;
        this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
        this.attackTarget = targetUsername;
        this.state = 'attacking';
        targetSprite.attacker = this.username;
    }

    attackSlime(slime) {
        this.originalX = this.x;
        this.startX = this.x;
        this.targetX = slime.x;
        this.totalDist = Math.max(1, Math.abs(this.targetX - this.startX));
        const desiredHopLength = 60;
        this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
        this.attackTargetSlime = slime;
        this.state = 'attacking_slime';
    }

    hurt() {
        // Randomize the damage reaction phrase each hit for variety
        const hurtPhrases = ['💥 Ouch!', '⚡ Critical!', '💀 Oof!', '💢 Bam!', '💥 Wham!', '🩸 Argh!', '💫 Swoosh!'];
        this.hurtPhrase = hurtPhrases[Math.floor(Math.random() * hurtPhrases.length)];

        this.hitEffectTimer = 18; // double flash window (~0.3s)
        
        // Apply pending health drop and ghost state right at the moment of impact/hurt!
        this.health = this.pendingHealth;
        this.maxHealth = this.pendingMaxHealth;

        if (this.pendingGhost) {
            this.isGhost = true;
            this.pendingGhost = false;
            // Immediately clear the hurt state so the damage text doesn't stick onto the rising ghost
            this.state = 'idle';
            this.stateTimer = 0;
            this.ascending = true;
            this.ascensionStartTime = Date.now();
            this.ascensionStartY = this.y;
            this.ascensionTargetY = canvas.height - 65; // canvas.height - 25 - 40
        } else {
            // Flee away from attacker to gain space
            this.state = 'fleeing';
            this.startX = this.x;
            const attackerSprite = sprites.get(this.attacker);
            const fleeDir = attackerSprite ? (this.x >= attackerSprite.x ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
            const fleeDist = 160 + Math.random() * 80; // run away 160-240px
            this.targetX = this.x + fleeDir * fleeDist;
            this.totalDist = this.wrappedDist(this.startX, this.targetX);
            const desiredHopLength = 60;
            this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
        }

        // Spawn blood splatter particles at sprite world position (x, y - size/2)
        for (let i = 0; i < 5; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y - 26));
        }
    }

    wrapX(x) {
        return (x + canvas.width) % canvas.width;
    }

    wrappedDiff(target, current) {
        let diff = target - current;
        if (diff > canvas.width / 2) diff -= canvas.width;
        if (diff < -canvas.width / 2) diff += canvas.width;
        return diff;
    }

    wrappedDist(a, b) {
        return Math.abs(this.wrappedDiff(b, a));
    }

    setHealth(health, maxHealth) {
        // Defer health update until hurt() fires so the health bar only drops when the hit lands
        this.pendingHealth = health;
        this.pendingMaxHealth = maxHealth;
    }

    respawnHealth(health, maxHealth) {
        // Immediate health update, clear ghost state, and start falling animation from hover height
        this.health = health;
        this.maxHealth = maxHealth;
        this.pendingHealth = health;
        this.pendingMaxHealth = maxHealth;
        this.isGhost = false;
        this.ascending = false;
        this.pendingGhost = false;
        
        // Start falling from ghost hover height (canvas.height - 65) down to ground
        this.state = 'falling';
        this.startX = this.x;
        this.targetX = this.x;
        this.totalDist = 0;
        this.hopCount = 0;
        // Falling velocity for smooth gravity fall
        this.fallVelocity = 0;
    }

    setGhost(isGhost) {
        this.isGhost = isGhost;
        this.pendingGhost = false;
        if (isGhost) {
            this.state = 'idle';
            this.stateTimer = 0;
            this.ascending = true;
            this.ascensionStartTime = Date.now();
            this.ascensionStartY = this.y;
            this.ascensionTargetY = canvas.height - 65;
        } else {
            this.ascending = false;
        }
    }

    setKillStreak(streak) {
        this.killStreak = streak;
        this.killStreakTimer = 180; // ~3 seconds at 60fps
    }

    setEnhanced(isEnhanced) {
        this.isEnhanced = isEnhanced;
    }

    setBuffGlow(active) {
        this.buffGlow = active;
        this.buffGlowTimer = 60 * 60; // 60 seconds at 60fps
    }

    nudge(direction) {
        if (this.isGhost) return; // Ghosts can only wave
        const nudgePx = 180; // much further push for visible effect
        // Allow nudges to wrap around screen edges (no clamping)
        this.nudgeTargetX = this.x + (direction === 'left' ? -nudgePx : nudgePx);
        this.nudgeExpiresAt = Date.now() + 1500;
    }

    dance() {
        if (this.isGhost) return; // Ghosts can only wave
        this.state = 'dancing';
        this.stateTimer = 120; // ~2 seconds at 60fps
    }

    taunt() {
        if (this.isGhost) return; // Ghosts can only wave
        this.state = 'taunting';
        this.stateTimer = 120; // ~2 seconds at 60fps
    }

    draw(ctx) {
        // If ascending into ghost form, draw a soft vertical cyan-gold beam with smooth fading edges on all sides
        if (this.ascending) {
            const elapsed = Date.now() - this.ascensionStartTime;
            const progress = elapsed / this.ascensionDuration;
            const peakAlpha = Math.sin(progress * Math.PI) * 0.38;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const size = 52;
            const ghostHoverY = canvas.height - 65;

            const top = ghostHoverY - size * 2.8;
            const bottom = canvas.height;
            const height = bottom - top;
            const beamRadius = size * 1.4;
            const centerX = this.x;

            const steps = 44;
            const sliceWidth = (beamRadius * 2) / steps;

            for (let i = 0; i < steps; i++) {
                const x0 = centerX - beamRadius + i * sliceWidth;
                const midX = x0 + sliceWidth / 2;

                const distX = Math.abs(midX - centerX) / beamRadius;
                if (distX > 1) continue;
                const horizWeight = Math.exp(-Math.pow(distX * 2.0, 2));
                const localAlpha = peakAlpha * horizWeight;

                const stripGrad = ctx.createLinearGradient(0, top, 0, bottom);
                stripGrad.addColorStop(0, 'rgba(120, 240, 255, 0)');
                stripGrad.addColorStop(0.2, `rgba(130, 255, 240, ${localAlpha * 0.85})`);
                stripGrad.addColorStop(0.5, `rgba(255, 245, 210, ${localAlpha})`);
                stripGrad.addColorStop(0.85, `rgba(100, 220, 255, ${localAlpha * 0.6})`);
                stripGrad.addColorStop(1, 'rgba(80, 200, 255, 0)');

                ctx.fillStyle = stripGrad;
                ctx.fillRect(x0, top, sliceWidth + 0.6, height);
            }

            ctx.restore();
        }

        const size = 52;
        // Draw main sprite
        this.drawSpriteInstance(ctx, this.x, this.y);

        // Seamless edge roll: if near screen edges, draw wrapped duplicate so it rolls smoothly across screen boundary
        if (this.x < size) {
            this.drawSpriteInstance(ctx, this.x + canvas.width, this.y);
        } else if (this.x > canvas.width - size) {
            this.drawSpriteInstance(ctx, this.x - canvas.width, this.y);
        }
    }

    drawSpriteInstance(ctx, renderX, renderY) {
        ctx.save();
        ctx.translate(renderX, renderY);

        const avatarImg = getAvatarImage(this.mcUser);
        const size = 52; // Avatar head size

        // Use eased squash values (smooth transitions)
        const squashX = this.currentSquashX;
        const squashY = this.currentSquashY;

        ctx.save();
        ctx.scale(squashX, squashY);

        // Ghost mode: 45% alpha (clearly translucent/see-through), cyan spectral glow & ice tint
        if (this.isGhost) {
            ctx.globalAlpha = 0.45;
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#62d6e8';
        }

        // Draw a Minecraft Slime block background with the avatar head mapped onto it
        const halfSize = size / 2;
        
        // Slime block green box (or golden/enchanted color if enhanced, or spectral pale ghost color, or magical RGB if buff active) with border/shading
        const time = Date.now();
        const hue = (time * 0.15) % 360;

        if (this.isGhost) {
            ctx.fillStyle = '#c5e3f6'; // Bright WoW Classic spectral ice-blue
            ctx.strokeStyle = '#4ba3e3';
        } else if (this.isEnhanced) {
            ctx.fillStyle = '#ffd700'; // Minecraft gold
            ctx.strokeStyle = '#b8860b'; // Dark goldenrod
        } else if (this.buffGlow) {
            ctx.fillStyle = `hsl(${hue}, 90%, 55%)`; // Magical RGB shimmering background
            ctx.strokeStyle = `hsl(${(hue + 180) % 360}, 90%, 40%)`; // Complementary border
        } else {
            ctx.fillStyle = '#72d653'; // Slime green
            ctx.strokeStyle = '#388e3c';
        }
        ctx.fillRect(-halfSize, -size, size, size);
        ctx.lineWidth = 3;
        ctx.strokeRect(-halfSize, -size, size, size);

        // Render magical RGB shimmering enchanted aura inside scale context so it squishes/stretches with the sprite
        if (this.buffGlow) {
            const pulse = Math.sin(time * 0.01) * 0.25 + 0.75;
            ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${pulse})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(-halfSize - 5, -size - 5, size + 10, size + 10);
            
            // Outer magical glow border
            ctx.strokeStyle = `hsla(${(hue + 90) % 360}, 100%, 60%, ${pulse * 0.6})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(-halfSize - 8, -size - 8, size + 16, size + 16);
        }

        // Draw avatar image on top if loaded, otherwise draw built-in procedural retro pixel Steve face instantly!
        if (avatarImg && avatarImg.complete && avatarImg.naturalWidth !== 0) {
            ctx.drawImage(avatarImg, -halfSize, -size, size, size);
        } else {
            // Instant procedural retro pixel Steve face (Brown hair, skin, blue eyes, shirt)
            const s = size / 8; // 8x8 grid
            const startX = -halfSize;
            const startY = -size;

            // Hair (top 2 rows)
            ctx.fillStyle = '#4a3525';
            ctx.fillRect(startX, startY, size, s * 2);
            ctx.fillRect(startX, startY + s * 2, s * 2, s * 2);
            ctx.fillRect(startX + s * 6, startY + s * 2, s * 2, s * 2);

            // Skin (face)
            ctx.fillStyle = '#d0a77b';
            ctx.fillRect(startX + s * 2, startY + s * 2, s * 4, s * 4);

            // Eyes
            ctx.fillStyle = '#2d4059';
            ctx.fillRect(startX + s * 2, startY + s * 3, s, s);
            ctx.fillRect(startX + s * 5, startY + s * 3, s, s);

            // Nose / Mouth
            ctx.fillStyle = '#b88c5f';
            ctx.fillRect(startX + s * 3, startY + s * 4, s * 2, s);
            ctx.fillStyle = '#8c5830';
            ctx.fillRect(startX + s * 3, startY + s * 5, s * 2, s);

            // Shirt (bottom 2 rows)
            ctx.fillStyle = '#3b5998';
            ctx.fillRect(startX, startY + s * 6, size, s * 2);
        }

        // Hit flash effect using source-atop - double flash with zoom
        if (this.hitEffectTimer > 0) {
            // Double flash: flash on even intervals (18-14, 10-6) - two pulses
            const flashPhase = Math.floor(this.hitEffectTimer / 4) % 2;
            if (flashPhase === 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 50, 50, 0.85)';
                ctx.fillRect(-size / 2, -size, size, size);
            }
            // Zoom punch effect - scale up slightly during flash windows
            const zoomIntensity = 0.15; // 15% zoom
            const zoomPhase = Math.floor(this.hitEffectTimer / 4) % 2;
            if (zoomPhase === 0) {
                ctx.scale(1 + zoomIntensity, 1 + zoomIntensity);
            }
        }
        ctx.globalCompositeOperation = 'source-over'; // Defensive reset for composite operation
        ctx.restore(); // Restores scale(squashX, squashY) and globalAlpha

        // Username tag and status above avatar
        const labelY = -size - 12;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.username, 0, labelY);
        ctx.fillText(this.username, 0, labelY);

        const statusY = labelY - 14;
        if (this.killStreakTimer > 0) {
            this.killStreakTimer--;
            if (this.killStreak >= 10) {
                ctx.fillText(`👑 ${this.killStreak} KILLS!`, 0, statusY);
            } else {
                ctx.fillText(`🔥 ${this.killStreak} kills!`, 0, statusY);
            }
        } else if (this.state === 'waving') {
            ctx.fillText('👋 waving', 0, statusY);
        } else if (this.state === 'attacking') {
            ctx.fillText('⚔️ attacking!', 0, statusY);
        } else if (this.state === 'hurt') {
            ctx.fillText(this.hurtPhrase, 0, statusY);
        } else if (this.state === 'fleeing') {
            // Show the hurt phrase while fleeing until they stop
            ctx.fillText(this.hurtPhrase, 0, statusY);
        }

        // Health bar (thin 3px red/green bar, positioned ABOVE the username label when damaged & not ghosted)
        if (!this.isGhost && this.health < this.maxHealth) {
            const barWidth = 48;
            const barHeight = 3;
            const barX = -barWidth / 2;
            const barY = labelY - 14; // Positioned above username label
            const healthPct = Math.max(0, this.health / this.maxHealth);
            
            // Background (dark)
            ctx.fillStyle = '#222222';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            // Foreground (red fill for health)
            ctx.fillStyle = '#f44336';
            ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);
            // Border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Minecraft Slime NPC Mobs (client-side ambient AI)
// ---------------------------------------------------------------------------
const slimeMobs = [];

class SlimeMob {
    constructor(x, y, tier = 'big') {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.tier = tier; // 'big', 'medium', 'tiny'

        if (tier === 'big') {
            this.size = 58;
            this.health = 4;
            this.maxHealth = 4;
            this.damage = 3;
            this.speed = 0.9;
        } else if (tier === 'medium') {
            this.size = 36;
            this.health = 2;
            this.maxHealth = 2;
            this.damage = 2;
            this.speed = 1.2;
        } else {
            this.size = 20;
            this.health = 2;
            this.maxHealth = 2;
            this.damage = 1;
            this.speed = 1.6;
        }

        this.state = 'idle'; // 'idle' or 'hopping'
        this.stateTimer = Math.floor(Math.random() * 90) + 30; // initial pause
        this.startX = x;
        this.targetX = x;
        this.totalDist = 0;
        this.hopCount = 1;
        this.facingRight = Math.random() > 0.5;
        this.squashX = 1;
        this.squashY = 1;
        this.hitEffectTimer = 0;
        this.exited = false;
        this.baseSpeed = this.speed;
        this.speed = this.baseSpeed * (0.7 + Math.random() * 0.6);
        // Smooth hop phase initialized randomly to avoid frame-1 jitter
        this.hopPhase = Math.random() * Math.PI * 2;
        // New slimes from splits start moving almost immediately (10-40 frames = 0.17-0.67s)
        this.stateTimer = Math.floor(Math.random() * 30) + 10;
        this.ageInFrames = 0;
        this.nextHuntFrame = 36000 + Math.floor(Math.random() * 7200); // 10 to 12 minutes (60fps)
        this.forcedHuntActive = false;
    }

    update() {
        this.groundY = canvas.height - 25;
        // No boundary clamping: slimes wrap seamlessly across screen edges like player sprites

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        // Decrement attack cooldown
        if (!this.attackCooldown) this.attackCooldown = 0;
        if (this.attackCooldown > 0) this.attackCooldown--;

        // Pass-by random hit check (3% chance when a player is within 30px, not on cooldown)
        if (this.attackCooldown === 0) {
            for (const [key, sprite] of sprites) {
                if (sprite.isGhost) continue;
                if (Math.abs(sprite.x - this.x) <= 30) {
                    if (Math.random() < 0.03) {
                        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                            wsInstance.send(JSON.stringify({
                                type: 'SLIME_ATTACK_PLAYER',
                                target: sprite.username,
                                damage: this.damage
                            }));
                        }
                        sprite.hurt();
                        for (let i = 0; i < 4; i++) {
                            bloodParticles.push(new BloodParticle(sprite.x, sprite.y - 20));
                        }
                        this.attackCooldown = 1800; // 30s cooldown
                        break;
                    }
                }
            }
        }

        // Periodic 10-minute forced hunt check
        this.ageInFrames++;
        if (this.ageInFrames >= this.nextHuntFrame) {
            this.nextHuntFrame = this.ageInFrames + 36000 + Math.floor(Math.random() * 7200); // 10-12 min
            const validPlayers = [];
            for (const [key, sprite] of sprites) {
                if (!sprite.isGhost) validPlayers.push(sprite);
            }
            if (validPlayers.length > 0) {
                const randomPlayer = validPlayers[Math.floor(Math.random() * validPlayers.length)];
                this.targetSprite = randomPlayer;
                this.forcedHuntActive = true;
                console.log(`[Slime] 10-minute forced hunt triggered targeting ${randomPlayer.username}!`);
            }
        }

        // Find nearest un-ghosted player
        let nearest = null;
        let minDist = Infinity;
        for (const [key, sprite] of sprites) {
            if (sprite.isGhost) continue;
            const d = Math.abs(sprite.x - this.x);
            if (d < minDist) {
                minDist = d;
                nearest = sprite;
            }
        }
        // Only update targetSprite if not in a forced hunt (forced hunt overrides nearest)
        if (!this.forcedHuntActive) {
            this.targetSprite = nearest;
        }

        if (this.forcedHuntActive && (!this.targetSprite || this.targetSprite.isGhost)) {
            this.forcedHuntActive = false;
        }

        let targetDist = this.targetSprite ? Math.abs(this.wrappedDiff(this.targetSprite.x, this.x)) : Infinity;

        if (this.targetSprite && (targetDist < 140 || this.forcedHuntActive)) {
            // Chase player (hysteresis band prevents chase/reach flicker)
            const dx = this.wrappedDiff(this.targetSprite.x, this.x);
            this.facingRight = dx > 0;
            const baseReach = 8.0; // tight physical touch range matching player attacks
            // Use hysteresis: once in chase, keep chasing until within 60% of reach
            const chaseThresh = this.isInChase ? baseReach * 0.6 : baseReach;

            if (Math.abs(dx) > chaseThresh) {
                this.isInChase = true;
                // Per-hop speed fluctuation for unique movement pacing
                if (Math.random() < 0.35) this.speed = this.baseSpeed * (0.7 + Math.random() * 0.6);
                const moveStep = Math.sign(dx) * (this.speed * 1.1);
                this.x += moveStep;
                this.x = this.wrapX(this.x);

                this.chaseDist = (this.chaseDist || 0) + Math.abs(moveStep);
                const hopCycle = 45; // pixels per hop cycle during chase
                const sinVal = Math.sin((this.chaseDist / hopCycle) * Math.PI);
                const hopHeight = this.size * 0.4;
                this.y = this.groundY - Math.abs(sinVal) * hopHeight;
                this.squashX = 1 + sinVal * 0.18;
                this.squashY = 1 - sinVal * 0.18;
            } else {
                // In reach — attack player (stand completely still, flat on ground)
                this.isInChase = false;
                this.chaseDist = 0;
                this.y = this.groundY;
                this.squashX = 1;
                this.squashY = 1;
                if (!this.attackCooldown) this.attackCooldown = 0;
                if (this.attackCooldown > 0) {
                    this.attackCooldown--;
                } else {
                    // Send damage request to server (authoritative health)
                    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                        wsInstance.send(JSON.stringify({
                            type: 'SLIME_ATTACK_PLAYER',
                            target: this.targetSprite.username,
                            damage: this.damage
                        }));
                    }
                    this.targetSprite.hurt();
                    for (let i = 0; i < 4; i++) {
                        bloodParticles.push(new BloodParticle(this.targetSprite.x, this.targetSprite.y - 20));
                    }
                    this.attackCooldown = this.tier === 'big' ? 1800 : (this.tier === 'medium' ? 2100 : 2400); // 30-40s cooldown
                    this.forcedHuntActive = false;
                }
            }
            return;
        }
        this.isInChase = false;

        if (this.state === 'idle') {
            this.y = this.groundY;
            this.squashX = 1;
            this.squashY = 1;

            if (this.stateTimer > 0) {
                this.stateTimer--;
            } else {
                // Fluctuate speed for next hop cycle
                this.speed = this.baseSpeed * (0.7 + Math.random() * 0.6);
                const exitChance = this.tier === 'big' ? 0.15 : 0.1;
                if (Math.random() < exitChance) {
                    const exitLeft = Math.random() > 0.5;
                    this.startX = this.x;
                    this.targetX = exitLeft ? -80 : canvas.width + 80;
                    this.totalDist = this.wrappedDist(this.startX, this.targetX);
                    const desiredHopLength = this.size * (Math.random() * 0.5 + 1.0);
                    this.hopCount = Math.max(2, Math.round(this.totalDist / desiredHopLength));
                    this.state = 'exiting';
                } else {
                    this.startX = this.x;
                    // Pick target anywhere in continuous wrapped space
                    this.targetX = Math.random() * (canvas.width + 200) - 100;
                    this.totalDist = this.wrappedDist(this.startX, this.targetX);
                    const desiredHopLength = this.size * (Math.random() * 0.5 + 1.0);
                    this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                    this.state = 'hopping';
                }
            }
        } else if (this.state === 'hopping') {
            const dx = this.wrappedDiff(this.targetX, this.x);
            this.facingRight = dx > 0;

            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
                this.x = this.wrapX(this.x);

                const traveled = this.wrappedDist(this.startX, this.x);
                const progress = Math.min(1, traveled / Math.max(1, this.totalDist));
                const hopHeight = this.size * 0.45;
                const sinVal = Math.sin(progress * Math.PI * this.hopCount);
                this.y = this.groundY - Math.abs(sinVal) * hopHeight;

                this.squashX = 1 + sinVal * 0.18;
                this.squashY = 1 - sinVal * 0.18;
            } else {
                this.x = this.targetX;
                this.y = this.groundY;
                this.squashX = 1;
                this.squashY = 1;
                this.state = 'idle';
                this.stateTimer = Math.floor(Math.random() * 180) + 60; // 1 to 4 seconds staggered pause
            }
        } else if (this.state === 'exiting') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;
            this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));

            const traveled = Math.abs(this.x - this.startX);
            const progress = Math.min(1, traveled / Math.max(1, this.totalDist));
            const hopHeight = this.size * 0.45;
            const sinVal = Math.sin(progress * Math.PI * this.hopCount);
            this.y = this.groundY - Math.abs(sinVal) * hopHeight;

            this.squashX = 1 + sinVal * 0.18;
            this.squashY = 1 - sinVal * 0.18;

            // Fully offscreen — mark for removal
            if (this.x < -60 || this.x > canvas.width + 60) {
                this.exited = true;
            }
        }
    }

    // Screen wrapping utilities (same as player sprites)
    wrapX(x) {
        return (x + canvas.width) % canvas.width;
    }
    wrappedDiff(target, current) {
        let diff = target - current;
        if (diff > canvas.width / 2) diff -= canvas.width;
        if (diff < -canvas.width / 2) diff += canvas.width;
        return diff;
    }
    wrappedDist(a, b) {
        return Math.abs(this.wrappedDiff(b, a));
    }

    hurt(amount = 2) {
        this.health -= amount;
        this.hitEffectTimer = 18; // Flash red/white when hit
        // Splash green blood particles on hit
        for (let i = 0; i < 4; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y - this.size / 2, '#2ecc71'));
        }

        if (this.health <= 0) {
            this.die();
            return true;
        }
        // Slight knockback hop to feel the hit
        this.hopPhase += 1.2;
        return false;
    }

    die() {
        // Splash green particles on death
        for (let i = 0; i < 8; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y - this.size / 2, '#2ecc71'));
        }
        // Cap total active slimes to prevent overwhelming the scene
        if (slimeMobs.length >= 40) return;

        const clampX = (x) => Math.max(50, Math.min(canvas.width - 50, x));

        if (this.tier === 'big') {
            // Split into 2 medium slimes with randomized spread, direction, and distance
            for (let i = 0; i < 2; i++) {
                const spreadOffset = (Math.random() - 0.5) * 80;
                const childX = clampX(this.x + spreadOffset);
                const child = new SlimeMob(childX, this.groundY, 'medium');
                child.state = 'hopping';
                child.startX = childX;
                // Random jump direction and distance (between 70px and 220px away)
                const jumpDist = Math.random() * 150 + 70;
                const jumpDir = Math.random() < 0.5 ? -1 : 1;
                child.targetX = clampX(childX + jumpDir * jumpDist);
                child.totalDist = Math.abs(child.targetX - child.startX);
                const desiredHopLength = child.size * (Math.random() * 0.4 + 1.0);
                child.hopCount = Math.max(1, Math.round(child.totalDist / desiredHopLength));
                child.hopPhase = Math.random() * Math.PI * 2;
                child.stateTimer = Math.floor(Math.random() * 40) + 15;
                child.attackCooldown = 1200; // 20 second spawn immunity before attacking
                slimeMobs.push(child);
            }
        } else if (this.tier === 'medium') {
            // Medium slimes simply vanish (no tiny slime spawns)
            return;
        }
        // Tiny slimes simply vanish (tier no longer used)
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.squashX, this.squashY);

        const size = this.size;
        const halfSize = size / 2;

        // 100% Opaque Vibrant Minecraft Slime Cube (Bright green gel)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#55ff55'; // Vivid Minecraft lime green
        ctx.fillRect(-halfSize, -size, size, size);

        // Darker inner core
        ctx.fillStyle = '#2ecc71';
        const inner = size * 0.6;
        ctx.fillRect(-inner / 2, -size * 0.8, inner, inner);

        // Thick black outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(-halfSize, -size, size, size);

        // Minecraft Slime face (black pixel eyes and mouth)
        const eyeSize = Math.max(4, size * 0.14);
        const eyeY = -size * 0.6;
        const dir = this.facingRight ? 1 : -1;
        ctx.fillStyle = '#000000';
        const eyeOffset = size * 0.28;
        
        // Two eyes
        ctx.fillRect(dir * eyeOffset - eyeSize / 2, eyeY, eyeSize, eyeSize * 1.5);
        ctx.fillRect(dir * eyeOffset * 0.3 - eyeSize / 2, eyeY, eyeSize, eyeSize * 1.5);

        // Mouth line
        ctx.fillRect(-size * 0.25, -size * 0.35, size * 0.5, eyeSize);

        // Hit flash effect (red/white flash when hurt)
        if (this.hitEffectTimer > 0) {
            const flashPhase = Math.floor(this.hitEffectTimer / 4) % 2;
            if (flashPhase === 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
                ctx.fillRect(-halfSize, -size, size, size);
            }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();

        // Health pips above when damaged
        if (this.health < this.maxHealth) {
            const pipW = 5;
            const pipH = 4;
            const gap = 1;
            const totalW = this.maxHealth * (pipW + gap) - gap;
            const startX = this.x - totalW / 2;
            const pipY = this.y - this.size - 10;
            for (let i = 0; i < this.maxHealth; i++) {
                ctx.fillStyle = i < this.health ? '#2ecc71' : '#333333';
                ctx.fillRect(startX + i * (pipW + gap), pipY, pipW, pipH);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.strokeRect(startX + i * (pipW + gap), pipY, pipW, pipH);
            }
        }
    }
}

// Spawn a big slime, starting visibly on screen
let slimeSpawnTimer = 0;
function spawnSlimeFromEdge() {
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -80 : canvas.width + 80;
    const targetX = Math.random() * (canvas.width - 240) + 120;
    const slime = new SlimeMob(startX, canvas.height - 25, 'big');
    slime.targetX = targetX;
    slime.startX = startX;
    slime.totalDist = Math.abs(targetX - startX);
    slime.hopCount = Math.max(2, Math.round(slime.totalDist / 70));
    slime.state = 'hopping';
    slimeMobs.push(slime);
    console.log(`[Slime] Big slime spawned offscreen at x=${startX}, hopping to x=${targetX}`);
}

// Click/tap a slime to damage it (players can defend themselves)
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Find slime under cursor (hit-test from topmost/tiny to bottom)
    for (let i = slimeMobs.length - 1; i >= 0; i--) {
        const s = slimeMobs[i];
        const half = s.size / 2;
        if (mx >= s.x - half && mx <= s.x + half && my >= s.y - s.size && my <= s.y) {
            const killed = s.hurt(2);
            if (killed) {
                slimeMobs.splice(i, 1);
            }
            break;
        }
    }
});

// WebSocket Connection
let wsInstance = null;
function connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsInstance = ws;

    ws.onopen = () => {
        console.log('Connected to sprite walker server');
    };

    ws.onmessage = (event) => {
        try {
            const cmd = JSON.parse(event.data);
            handleCommand(cmd);
        } catch (err) {
            console.error('Failed to parse WS message:', err);
        }
    };

    ws.onclose = () => {
        console.log('WS disconnected. Reconnecting in 3s...');
        setTimeout(connectWS, 3000);
    };
}

function handleCommand(cmd) {
    const { type, user, target, mcUser, health, maxHealth, isGhost, killStreak, isEnhanced, emote, direction, x, sprites: roster } = cmd;

    if (type === 'ROSTER_SYNC' && roster) {
        sprites.clear();
        for (const [username, data] of roster) {
            sprites.set(username, new Sprite(username, data.mcUser, data.health, data.maxHealth, data.isGhost, data.killStreak, data.isEnhanced));
        }
        console.log(`[Client] ROSTER_SYNC: ${sprites.size} sprites`, Array.from(sprites.keys()));
    } else if (type === 'SPRITE_JOIN') {
        const key = user.toLowerCase();
        sprites.set(key, new Sprite(user, mcUser, health, maxHealth, isGhost, killStreak, isEnhanced));
        console.log(`[Client] SPRITE_JOIN/UPDATE: ${user} (MC: ${mcUser}, HP: ${health}/${maxHealth}, Ghost: ${isGhost}), total: ${sprites.size}`);
    } else if (type === 'SPRITE_LEAVE') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            const sprite = sprites.get(key);
            // Start exit animation - hop off screen
            const edgeX = sprite.x < canvas.width / 2 ? -60 : canvas.width + 60;
            sprite.enterDirection = sprite.x < canvas.width / 2 ? 'left' : 'right';
            sprite.state = 'exiting';
            sprite.startX = sprite.x;
            sprite.targetX = edgeX;
            sprite.totalDist = Math.abs(edgeX - sprite.startX);
            const desiredHopLength = 60;
            sprite.hopCount = Math.max(1, Math.round(sprite.totalDist / desiredHopLength));
            // We'll remove it after the exit animation completes
        }
    } else if (type === 'SPRITE_WAVE') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).wave();
        }
    } else if (type === 'SPRITE_ATTACK') {
        const key = user.toLowerCase();
        const targetKey = target.toLowerCase();
        if (sprites.has(key) && sprites.has(targetKey)) {
            sprites.get(key).attack(targetKey);
        }
    } else if (type === 'SPRITE_DAMAGED') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            const sprite = sprites.get(key);
            sprite.setHealth(health, maxHealth);
            // Trigger hit animation (flash, blood particles, flee state) for any damage source
            sprite.hurt();
        }
    } else if (type === 'SPRITE_GHOST') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).setGhost(true);
            console.log(`[Client] ${user} entered GHOST mode`);
        }
    } else if (type === 'SPRITE_RESPAWN') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).setGhost(false);
            sprites.get(key).respawnHealth(health, maxHealth);
            console.log(`[Client] ${user} RESPAWNED`);
        }
    } else if (type === 'SPRITE_KILLSTREAK') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).setKillStreak(streak);
            console.log(`[Client] ${user} kill streak: ${streak}`);
        }
    } else if (type === 'SPRITE_ENHANCED') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).setEnhanced(isEnhanced);
            console.log(`[Client] ${user} enhanced: ${isEnhanced}`);
        }
    } else if (type === 'SPRITE_EMOTE') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            if (emote === 'dance') sprites.get(key).dance();
            else if (emote === 'taunt') sprites.get(key).taunt();
        }
    } else if (type === 'SPRITE_NUDGE') {
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).nudge(direction);
        }
    } else if (type === 'BUFF_DROP_SPAWN') {
        activeBuffDrop = new BuffDropParticle(x);
        buffDropParticles.push(activeBuffDrop);
        console.log(`[Client] Buff drop spawned at x=${x}`);
    } else if (type === 'BUFF_CLAIMED') {
        if (activeBuffDrop) {
            activeBuffDrop.claimed = true;
            activeBuffDrop.claimTime = Date.now();
        }
        const key = user.toLowerCase();
        if (sprites.has(key)) {
            sprites.get(key).setBuffGlow(true);
            console.log(`[Client] Buff claimed by ${user}`);
        }
    } else if (type === 'SLIME_SPAWN') {
        spawnSlimeFromEdge();
        console.log(`[Slime] Manual !slime spawn triggered`);
    } else if (type === 'SLIME_ATTACK_REQUEST') {
        // Player attacked a slime — find nearest slime to attacker's x position
        const attackerKey = user.toLowerCase();
        const attackerSprite = sprites.get(attackerKey);
        const attackerX = attackerSprite ? attackerSprite.x : (x || canvas.width / 2);
        let nearestSlime = null;
        let minDist = Infinity;
        for (const slime of slimeMobs) {
            const dx = slime.x - attackerX;
            const dist = Math.abs(dx);
            if (dist < minDist) {
                minDist = dist;
                nearestSlime = slime;
            }
        }
        if (nearestSlime) {
            if (attackerSprite) {
                attackerSprite.attackSlime(nearestSlime);
            } else {
                const died = nearestSlime.hurt(4);
                if (died) {
                    console.log(`[Slime] ${nearestSlime.tier} slime killed by ${user}`);
                } else {
                    console.log(`[Slime] ${nearestSlime.tier} slime hit by ${user} (HP: ${nearestSlime.health}/${nearestSlime.maxHealth})`);
                }
            }
        }
    }
}

// Render Loop
function animate() {
    // Defensive full state reset at the start of every frame
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sort sprites by X position for depth layering and clean up exited sprites
    const sortedSprites = [];
    for (const [key, sprite] of sprites.entries()) {
        if (sprite.exited) {
            sprites.delete(key);
            continue;
        }
        sortedSprites.push(sprite);
    }
    sortedSprites.sort((a, b) => a.y - b.y);

    for (const sprite of sortedSprites) {
        sprite.update();
        sprite.draw(ctx);
    }

    // Blood splatter particles (update + draw, remove dead ones)
    for (let i = bloodParticles.length - 1; i >= 0; i--) {
        const p = bloodParticles[i];
        if (p.update()) {
            p.draw(ctx);
        } else {
            bloodParticles.splice(i, 1);
        }
    }

    // Slime Mobs — update, draw, and periodic spawn (randomized ~10 min intervals)
    if (!window.nextSlimeSpawnIn) {
        window.nextSlimeSpawnIn = Math.floor(Math.random() * 14400) + 28800; // 8-12 min @ 60fps
    }
    if (++slimeSpawnTimer >= window.nextSlimeSpawnIn) {
        slimeSpawnTimer = 0;
        window.nextSlimeSpawnIn = Math.floor(Math.random() * 14400) + 28800; // re-roll for next spawn
        if (slimeMobs.length < 2) { // cap at 2 active big slimes
            spawnSlimeFromEdge();
        }
    }
    for (let i = slimeMobs.length - 1; i >= 0; i--) {
        const s = slimeMobs[i];
        s.update();
        s.draw(ctx);
        // Remove dead slimes or slimes that have exited offscreen
        if (s.health <= 0 || s.exited) {
            slimeMobs.splice(i, 1);
        }
    }

    // Ghost wispy wisp particles (update + draw, remove dead ones)
    for (let i = ghostParticles.length - 1; i >= 0; i--) {
        const p = ghostParticles[i];
        if (p.update()) {
            p.draw(ctx);
        } else {
            ghostParticles.splice(i, 1);
        }
    }

    // Buff drop particles (update + draw, remove dead/claimed ones)
    for (let i = buffDropParticles.length - 1; i >= 0; i--) {
        const p = buffDropParticles[i];
        if (p.update()) {
            p.draw(ctx);
        } else {
            buffDropParticles.splice(i, 1);
            if (p === activeBuffDrop) activeBuffDrop = null;
        }
    }

    requestAnimationFrame(animate);
}

connectWS();
animate();