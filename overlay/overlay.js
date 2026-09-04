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

// Minecraft Diamond Drop falling particle
const diamondDrops = [];
let activeDiamondDrop = null;

class MinecraftDiamondDrop {
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
        const fallDuration = 1000; // 1s fall
        const progress = Math.min(1, elapsed / fallDuration);
        // Ease out bounce
        const eased = 1 - Math.pow(1 - progress, 3);
        this.y = -30 + eased * (this.groundY - (-30));
        
        // Once landed on the floor, gently bob up and down
        if (progress >= 1) {
            this.y = this.groundY + Math.sin(Date.now() * 0.006) * 4;
        }
        return true;
    }
    draw(ctx) {
        ctx.save();
        if (this.claimed) {
            ctx.globalAlpha = Math.max(0, (this.claimTime + 500 - Date.now()) / 500);
        }

        ctx.translate(this.x, this.y);

        // Draw classic Minecraft Diamond item shape (pixelated gem)
        ctx.fillStyle = '#00ffff'; // Cyan diamond body
        ctx.strokeStyle = '#004444';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -4);
        ctx.lineTo(6, 12);
        ctx.lineTo(0, 16);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner lighter facets for 3D diamond shine
        ctx.fillStyle = '#80ffff';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(6, -3);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, -3);
        ctx.closePath();
        ctx.fill();

        // Bright white highlight specular top-left
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -8, 3, 3);

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

        // HP Regeneration state
        this.lastDamageTime = Date.now();
        this.lastHealTime = Date.now();
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

        // HP Regeneration: after 60s of no damage, heal +1 HP every 30s until full
        if (!this.isGhost && this.health < this.maxHealth) {
            const now = Date.now();
            const timeSinceDamage = now - this.lastDamageTime;
            if (timeSinceDamage >= 60000) {
                const timeSinceLastHeal = now - this.lastHealTime;
                if (timeSinceLastHeal >= 30000) {
                    this.health = Math.min(this.maxHealth, this.health + 1);
                    this.pendingHealth = this.health;
                    this.lastHealTime = now;
                    console.log(`[HP Regen] ${this.username} regenerated 1 HP (${this.health}/${this.maxHealth})`);
                }
            }
        } else {
            // At full health or ghosted — keep timers fresh so regen restarts from scratch on next damage
            this.lastDamageTime = Date.now();
            this.lastHealTime = Date.now();
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
            // Random chance to start hopping to a new position ANYWHERE (including wrapped space)
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
        
        // Damage resets both HP regen timers so healing restarts from scratch
        this.lastDamageTime = Date.now();
        this.lastHealTime = Date.now();

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
        if (health < this.health) {
            this.lastDamageTime = Date.now();
            this.lastHealTime = Date.now();
        }
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
        // Skip while entering or exiting — sprite is deliberately off-canvas, not actually wrapping
        if (this.state !== 'entering' && this.state !== 'exiting') {
            if (this.x < size) {
                this.drawSpriteInstance(ctx, this.x + canvas.width, this.y);
            } else if (this.x > canvas.width - size) {
                this.drawSpriteInstance(ctx, this.x - canvas.width, this.y);
            }
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
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; // Soft 35% opacity white border
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
        this.speed = this.baseSpeed * (0.4 + Math.random() * 1.8);
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
        if (!this.age) this.age = 0;
        this.age++;
        if (this.age >= 18000) {
            this.exited = true;
        }

        // Silky-smooth slime-to-slime soft dispersion using wrapped distance
        for (const other of slimeMobs) {
            if (other === this) continue;
            let diff = other.x - this.x;
            if (diff > canvas.width / 2) diff -= canvas.width;
            if (diff < -canvas.width / 2) diff += canvas.width;
            const dist = Math.abs(diff);
            if (dist < 55 && dist > 0) {
                const glideDir = Math.sign(diff);
                this.x += glideDir * 0.35;
            }
        }

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        // Decrement attack cooldown
        if (!this.attackCooldown) this.attackCooldown = 0;
        if (this.attackCooldown > 0) this.attackCooldown--;

        // Neutral pass-by random hit check (3% chance when a player is within 30px wrapped distance, not on cooldown)
        if (this.attackCooldown === 0) {
            for (const [key, sprite] of sprites) {
                if (sprite.isGhost) continue;
                let diff = sprite.x - this.x;
                if (diff > canvas.width / 2) diff -= canvas.width;
                if (diff < -canvas.width / 2) diff += canvas.width;
                if (Math.abs(diff) <= 30) {
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

        // Slimes are neutral ambient wanderers — no player chasing or forced hunt!

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

        

        if (this.state === 'idle') {
            this.y = this.groundY;
            this.squashX = 1;
            this.squashY = 1;

            if (this.stateTimer > 0) {
                this.stateTimer--;
            } else {
                // Fluctuate speed for next hop cycle
                this.speed = this.baseSpeed * (0.4 + Math.random() * 1.8);
                const exitChance = this.tier === 'big' ? 0.15 : 0.1;
                if (Math.random() < exitChance) {
                    const exitLeft = Math.random() > 0.5;
                    this.startX = this.x;
                    this.targetX = exitLeft ? -80 : canvas.width + 80;
                    this.totalDist = Math.abs(this.targetX - this.startX);
                    const desiredHopLength = this.size * (Math.random() * 0.5 + 1.0);
                    this.hopCount = Math.max(2, Math.round(this.totalDist / desiredHopLength));
                    this.state = 'exiting';
                } else {
                    this.startX = this.x;
                    // Pick target strictly within screen bounds
                    this.targetX = Math.random() * (canvas.width - 160) + 80;
                    this.totalDist = Math.abs(this.targetX - this.startX);
                    const desiredHopLength = this.size * (Math.random() * 0.5 + 1.0);
                    this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                    this.state = 'hopping';
                }
            }
        } else if (this.state === 'hopping') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;

            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));

                const traveled = Math.abs(this.x - this.startX);
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
        } else if (this.state === 'entering') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;

            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
                // Do NOT wrap X during entrance so slimes stay offscreen until reaching target

                const traveled = Math.abs(this.x - this.startX);
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
                this.stateTimer = Math.floor(Math.random() * 180) + 60;
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

    // No wrapping utilities: slimes navigate in linear screen coordinates
    // and exit cleanly off-edge instead of wrapping around.

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

// ---------------------------------------------------------------------------
// Creeper NPC Mobs (client-side ambient AI) - Explode when near players!
// ---------------------------------------------------------------------------

class CreeperExplosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            this.particles.push({
                x: x,
                y: y - 24,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                size: 4 + Math.random() * 8,
                color: Math.random() > 0.5 ? '#55ff55' : '#ffffff',
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    update() {
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
        }
        this.particles = this.particles.filter(p => p.alpha > 0);
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.restore();
    }

    isDead() {
        return this.particles.length === 0;
    }
}

const creeperMobs = [];
const creeperExplosions = [];

class CreeperMob {
    constructor(x, y) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 30; // Head width for hit-testing
        this.health = 3;
        this.maxHealth = 3;
        this.damage = 3;
        this.speed = 1.0;

        this.state = 'entering'; // entering, wandering, fusing, exiting
        this.stateTimer = Math.floor(Math.random() * 90) + 30;
        this.startX = x;
        this.targetX = x;
        this.facingRight = Math.random() > 0.5;
        this.hitEffectTimer = 0;
        this.exited = false;

        this.fuseTimer = 0;
        this.maxFuse = 90; // 1.5 seconds @ 60fps
    }

    update() {
        this.groundY = canvas.height - 25;
        if (!this.age) this.age = 0;
        this.age++;
        if (this.age >= 18000) {
            this.exited = true;
        }

        // Separation steering from other creepers/slimes
        for (const other of [...slimeMobs, ...creeperMobs]) {
            if (other === this) continue;
            const dist = Math.abs(other.x - this.x);
            if (dist < 45 && dist > 0) {
                const glideDir = Math.sign(this.x - other.x);
                this.x += glideDir * 0.3;
            }
        }

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        if (this.state === 'entering') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
            } else {
                this.x = this.targetX;
                this.state = 'wandering';
                this.stateTimer = Math.floor(Math.random() * 120) + 60;
            }
        } else if (this.state === 'wandering') {
            // Check proximity to any player sprite across screen seam using wrappedDist
            let nearestPlayer = null;
            let minPlayerDist = Infinity;
            for (const [_, sprite] of sprites) {
                if (sprite.isGhost) continue;
                // compute wrapped distance
                let diff = sprite.x - this.x;
                if (diff > canvas.width / 2) diff -= canvas.width;
                if (diff < -canvas.width / 2) diff += canvas.width;
                const dist = Math.abs(diff);
                if (dist < minPlayerDist) {
                    minPlayerDist = dist;
                    nearestPlayer = sprite;
                }
            }

            if (nearestPlayer && minPlayerDist <= 55) {
                this.state = 'fusing';
                this.fuseTimer = this.maxFuse;
                console.log(`[Creeper] Fuse lit near player!`);
            } else {
                // Normal wander / creep toward random target
                if (this.stateTimer > 0) {
                    this.stateTimer--;
                } else {
                    this.targetX = Math.random() * (canvas.width - 160) + 80;
                    this.stateTimer = Math.floor(Math.random() * 180) + 90;
                }
                const dx = this.targetX - this.x;
                if (Math.abs(dx) > 1.5) {
                    this.facingRight = dx > 0;
                    this.x += Math.sign(dx) * Math.min(this.speed * 0.8, Math.abs(dx));
                }
            }
        } else if (this.state === 'fusing') {
            // Stop and flash
            this.fuseTimer--;
            if (this.fuseTimer <= 0) {
                // EXPLODE!
                creeperExplosions.push(new CreeperExplosion(this.x, this.y));
                // Damage ALL entities within blast radius (100px) — players, slimes, creepers, zombies
                const blastRadius = 100;
                const damage = 120; // One-shot for players, heavy damage for mobs

                // Damage players (server-synced, respect ghost mode)
                for (const [_, sprite] of sprites) {
                    if (sprite.isGhost) continue;
                    let diff = sprite.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    const dist = Math.abs(diff);
                    if (dist < blastRadius) {
                        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                            wsInstance.send(JSON.stringify({ type: 'CREEPER_EXPLOSION', target: sprite.username, damage }));
                        }
                        sprite.hurt();
                    }
                }

                // Damage slimes (local only)
                for (const slime of slimeMobs) {
                    let diff = slime.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    if (Math.abs(diff) < blastRadius) {
                        slime.hurt(damage);
                    }
                }

                // Damage other creepers (local only)
                for (const creeper of creeperMobs) {
                    let diff = creeper.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    if (Math.abs(diff) < blastRadius) {
                        creeper.hurt(damage);
                    }
                }

                // Damage zombies (local only)
                for (const zombie of zombieMobs) {
                    let diff = zombie.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    if (Math.abs(diff) < blastRadius) {
                        zombie.hurt(damage);
                    }
                }

                this.exited = true;
            }
        } else if (this.state === 'exiting') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;
            this.x += Math.sign(dx) * this.speed;
            if (this.x < -60 || this.x > canvas.width + 60) {
                this.exited = true;
            }
        }
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 14;
        if (this.health <= 0) {
            creeperExplosions.push(new CreeperExplosion(this.x, this.y));
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const totalHeight = 60; // Slightly taller than player avatars
        const headSize = 28;
        const bodyWidth = 24;
        const bodyHeight = 22;
        const feetHeight = 8;
        const feetWidth = 28;

        // Fusing white flash pulse check
        const isFlashing = this.state === 'fusing' && Math.floor(this.fuseTimer / 6) % 2 === 0;
        ctx.fillStyle = isFlashing ? '#ffffff' : '#3c993c';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;

        // 1. Draw Feet (bottom flat rectangle)
        ctx.fillRect(-feetWidth / 2, -feetHeight, feetWidth, feetHeight);
        ctx.strokeRect(-feetWidth / 2, -feetHeight, feetWidth, feetHeight);

        // 2. Draw Body (middle box)
        ctx.fillRect(-bodyWidth / 2, -feetHeight - bodyHeight, bodyWidth, bodyHeight);
        ctx.strokeRect(-bodyWidth / 2, -feetHeight - bodyHeight, bodyWidth, bodyHeight);

        // 3. Draw Head (upper box sitting on body)
        const headY = -totalHeight;
        ctx.fillStyle = isFlashing ? '#ffffff' : '#45b345';
        ctx.fillRect(-headSize / 2, headY, headSize, headSize);
        ctx.strokeRect(-headSize / 2, headY, headSize, headSize);

        // Creeper Face on Head
        ctx.fillStyle = '#000000';
        const dir = this.facingRight ? 1 : -1;
        // Eyes
        ctx.fillRect(dir * 5 - 3, headY + 7, 6, 8);
        ctx.fillRect(dir * -3 - 3, headY + 7, 6, 8);
        // Nose & Mouth (T-shape)
        ctx.fillRect(-3, headY + 16, 6, 6);
        ctx.fillRect(-7, headY + 20, 14, 5);

        if (this.state === 'fusing') {
            ctx.fillStyle = '#ff3333';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Sssss...', 0, -totalHeight - 8);
        }

        ctx.restore();
    }
}

function spawnCreeperFromEdge() {
    if (slimeMobs.length + creeperMobs.length >= 6) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -80 : canvas.width + 80;
    const targetX = Math.random() * (canvas.width - 240) + 120;
    const creeper = new CreeperMob(startX, canvas.height - 25);
    creeper.targetX = targetX;
    creeper.startX = startX;
    creeper.state = 'entering';
    creeperMobs.push(creeper);
    console.log(`[Creeper] Spawned offscreen at x=${startX}, walking to x=${targetX}`);
}

// ---------------------------------------------------------------------------
// Zombie NPC Mobs (client-side ambient AI) - Shamble and melee attack players
// ---------------------------------------------------------------------------

const zombieMobs = [];
const ghastMobs = [];

class ZombieMob {
    constructor(x, y) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 28; // hit test width
        this.health = 3;
        this.maxHealth = 3;
        this.damage = 30;
        this.speed = 0.8; // slower, shambling

        this.state = 'entering'; // entering, wandering, exiting
        this.stateTimer = Math.floor(Math.random() * 90) + 30;
        this.startX = x;
        this.targetX = x;
        this.facingRight = Math.random() > 0.5;
        this.hitEffectTimer = 0;
        this.exited = false;
        this.shamblePhase = 0;
        this.attackCooldown = 0;
    }

    update() {
        this.groundY = canvas.height - 25;
        this.y = this.groundY;
        if (!this.age) this.age = 0;
        this.age++;
        if (this.age >= 18000) {
            this.exited = true;
        }

        // Separation steering
        for (const other of [...slimeMobs, ...creeperMobs, ...zombieMobs]) {
            if (other === this) continue;
            const dist = Math.abs(other.x - this.x);
            if (dist < 45 && dist > 0) {
                const glideDir = Math.sign(this.x - other.x);
                this.x += glideDir * 0.3;
            }
        }

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;
        if (this.attackCooldown > 0) this.attackCooldown--;

        // Heavy zombie lurch cycle: fast "caught" surge, then slow drag, repeat.
        // lurchFactor peaks near 1.0 at surge, dips low for the drag.
        const lurchCycle = this.shamblePhase;
        const lurchFactor = Math.pow(Math.abs(Math.sin(lurchCycle * 0.5)), 0.6) * 1.6 + 0.35;

        if (this.state === 'entering') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min((this.speed + 0.4) * lurchFactor, Math.abs(dx));
                this.shamblePhase += 0.11;
            } else {
                this.x = this.targetX;
                this.state = 'wandering';
                this.stateTimer = Math.floor(Math.random() * 120) + 60;
            }
        } else if (this.state === 'wandering') {
            // Check proximity to any player sprite across screen seam using wrappedDist
            let nearestPlayer = null;
            let minPlayerDist = Infinity;
            for (const [_, sprite] of sprites) {
                if (sprite.isGhost) continue;
                let diff = sprite.x - this.x;
                if (diff > canvas.width / 2) diff -= canvas.width;
                if (diff < -canvas.width / 2) diff += canvas.width;
                const dist = Math.abs(diff);
                if (dist < minPlayerDist) {
                    minPlayerDist = dist;
                    nearestPlayer = sprite;
                }
            }

            if (nearestPlayer && minPlayerDist <= 50 && this.attackCooldown === 0) {
                // Attack player!
                this.attackCooldown = 120; // 2s cooldown between attacks
                if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                    wsInstance.send(JSON.stringify({ type: 'ZOMBIE_ATTACK', target: nearestPlayer.username, damage: 30 }));
                }
                nearestPlayer.hurt();
                console.log(`[Zombie] Attacked player ${nearestPlayer.username} for 30 damage!`);
            } else {
                if (this.stateTimer > 0) {
                    this.stateTimer--;
                } else {
                    this.targetX = Math.random() * (canvas.width - 160) + 80;
                    this.stateTimer = Math.floor(Math.random() * 180) + 90;
                }
                const dx = this.targetX - this.x;
                if (Math.abs(dx) > 1.5) {
                    this.facingRight = dx > 0;
                    this.x += Math.sign(dx) * Math.min((this.speed + 0.4) * lurchFactor, Math.abs(dx));
                    this.shamblePhase += 0.11;
                }
            }
        } else if (this.state === 'exiting') {
            const dx = this.targetX - this.x;
            this.facingRight = dx > 0;
            this.x += Math.sign(dx) * (this.speed + 0.4) * lurchFactor;
            this.shamblePhase += 0.11;
            if (this.x < -60 || this.x > canvas.width + 60) {
                this.exited = true;
            }
        }
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 14;
        // Spawn blood particles (Minecraft zombie blood is dark red)
        for (let i = 0; i < 6; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y - 30, '#8b0000'));
        }
        return this.health <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const flashing = this.hitEffectTimer > 0 && Math.floor(this.hitEffectTimer / 3) % 2 === 0;
        const isMoving = this.state === 'entering' || this.state === 'wandering' || this.state === 'exiting';

        // Heavy forward lean while walking (zombie shuffle stance)
        const leanPeak = Math.sin(this.shamblePhase * 0.5) * 0.15;
        const lean = isMoving ? (this.facingRight ? -Math.abs(leanPeak) * 0.6 - 0.05 : Math.abs(leanPeak) * 0.6 + 0.05) : 0;
        ctx.rotate(lean);

        // Smooth gait: legs swing with the lurch cycle
        const legSwing = isMoving ? Math.sin(this.shamblePhase) * 5 : 0;
        const bodyBob = isMoving ? Math.abs(Math.sin(this.shamblePhase * 2)) * 2.5 : 0;

        const feetHeight = 14;
        const bodyWidth = 20;
        const bodyHeight = 22;
        const armReach = 16;
        const dir = this.facingRight ? 1 : -1;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;

        // --- 1. Legs (solidly planted at ground y=0, piston lurch) ---
        ctx.fillStyle = flashing ? '#ffffff' : '#1e3f66'; // dark pants
        // Left leg / monster leg stepping
        ctx.fillRect(-11 + legSwing * 0.7, -feetHeight + Math.max(0, legSwing) * 0.5, 9, feetHeight - Math.max(0, legSwing) * 0.5);
        ctx.strokeRect(-11 + legSwing * 0.7, -feetHeight + Math.max(0, legSwing) * 0.5, 9, feetHeight - Math.max(0, legSwing) * 0.5);
        // Right leg
        ctx.fillRect(2 - legSwing * 0.7, -feetHeight + Math.max(0, -legSwing) * 0.5, 9, feetHeight - Math.max(0, -legSwing) * 0.5);
        ctx.strokeRect(2 - legSwing * 0.7, -feetHeight + Math.max(0, -legSwing) * 0.5, 9, feetHeight - Math.max(0, -legSwing) * 0.5);

        // --- 2. Torso (Cyan shirt) sits directly on the legs ---
        const bodyY = -feetHeight - bodyHeight - bodyBob;
        ctx.fillStyle = flashing ? '#a0e0e0' : '#007a7a';
        ctx.fillRect(-bodyWidth / 2, bodyY, bodyWidth, bodyHeight);
        ctx.strokeRect(-bodyWidth / 2, bodyY, bodyWidth, bodyHeight);

        // --- 3. Outstretched Arms reaching forward (classic zombie pose, firmly attached) ---
        ctx.fillStyle = flashing ? '#ffffff' : '#3c8527';
        const armY = bodyY + 3;
        // Front arm (reaches further forward)
        ctx.fillRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY, armReach, 8);
        ctx.strokeRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY, armReach, 8);
        // Back arm (slightly nearer)
        ctx.fillRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY + 9, armReach - 3, 7);
        ctx.strokeRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY + 9, armReach - 3, 7);

        // --- 4. Head (firmly on top of the torso, slight forward tilt) ---
        const headSize = 24;
        const headY = bodyY - headSize;
        ctx.fillStyle = flashing ? '#ffffff' : '#3c8527';
        ctx.fillRect(-headSize / 2, headY, headSize, headSize);
        ctx.strokeRect(-headSize / 2, headY, headSize, headSize);

        // Face (drawn forward-facing, offset toward travel)
        ctx.fillStyle = '#000000';
        ctx.fillRect(dir * 4 - 3, headY + 7, 4, 4);   // Eyes
        ctx.fillRect(dir * -2 - 3, headY + 7, 4, 4);
        ctx.fillRect(-2, headY + 15, 5, 3);           // Mouth

        ctx.restore();
    }
}

// Ghast Fireball projectile (organic multi-layer ball of flame)
const ghastFireballs = [];
class GhastFireball {
    constructor(x, y, vx = 0, vy = 2.5) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = 16;
        this.exited = false;
        this.animPhase = Math.random() * Math.PI * 2;
    }
    update() {
        this.animPhase += 0.3;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0) this.x += canvas.width;
        if (this.x > canvas.width) this.x -= canvas.width;

        const groundY = canvas.height - 25;
        if (this.y >= groundY) {
            this.exited = true;
            for (let i = 0; i < 10; i++) {
                bloodParticles.push(new BloodParticle(this.x, groundY, '#ff4500'));
            }
        }
        for (const [_, sprite] of sprites) {
            if (sprite.isGhost) continue;
            let diff = sprite.x - this.x;
            if (diff > canvas.width / 2) diff -= canvas.width;
            if (diff < -canvas.width / 2) diff += canvas.width;
            if (Math.abs(diff) < 28 && Math.abs(sprite.y - this.y) < 38) {
                this.exited = true;
                const damage = 50; // 2-shot kill (MAX_HEALTH=100)
                if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                    wsInstance.send(JSON.stringify({ type: 'GHAST_FIREBALL_HIT', target: sprite.username, damage }));
                }
                sprite.hurt();
                for (let i = 0; i < 8; i++) {
                    bloodParticles.push(new BloodParticle(sprite.x, sprite.y, '#ff3300'));
                }
                break;
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Multi-layered organic flame visual
        const flamePulse = Math.sin(this.animPhase) * 3;
        
        // Outer red/orange flame glow
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(0, 0, this.size + flamePulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright orange-yellow flame core
        ctx.fillStyle = '#ff9900';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.7 + flamePulse * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Center white-yellow fiery hot center
        ctx.fillStyle = '#ffff66';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Level 3 — Ghast: huge floating Minecraft ghast doing a single bombing run across the screen
class GhastMob {
    constructor(x, y, fromLeft) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 85;
        this.health = 8;
        this.maxHealth = 8;
        this.fromLeft = fromLeft;
        this.vx = fromLeft ? 0.8 : -0.8; // Original majestic flight speed
        this.fireCooldown = Math.floor(Math.random() * 80) + 40;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.hitEffectTimer = 0;
        this.exited = false;
        this.mouthOpen = false;
        this.fireChargeTimer = 0;
    }

    update() {
        this.swayPhase += 0.025;
        this.y = this.groundY + Math.sin(this.swayPhase) * 6;

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        // Fly across screen once and despawn immediately when reaching the opposite edge
        this.x += this.vx;
        if (this.fromLeft && this.x > canvas.width) {
            this.exited = true;
        } else if (!this.fromLeft && this.x < 0) {
            this.exited = true;
        }

        // Shoot fireballs during pass
        if (this.fireCooldown > 0) {
            this.fireCooldown--;
        } else {
            this.mouthOpen = true;
            this.fireChargeTimer = 40; // 0.65s charge
            this.fireCooldown = Math.floor(Math.random() * 60) + 180;
        }

        if (this.fireChargeTimer > 0) {
            this.fireChargeTimer--;
            if (this.fireChargeTimer === 0) {
                this.mouthOpen = false;

                // Find nearest player to aim at
                let nearestPlayer = null;
                let minDist = Infinity;
                for (const [_, sprite] of sprites) {
                    if (sprite.isGhost) continue;
                    let diff = sprite.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    const dist = Math.abs(diff);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestPlayer = { sprite, diff };
                    }
                }

                let aimVx = 0;
                let aimVy = 2.5;
                if (nearestPlayer && Math.abs(nearestPlayer.diff) < 400) {
                    const inaccuracy = (Math.random() - 0.5) * 50;
                    const targetXOffset = nearestPlayer.diff + inaccuracy;
                    const fallDist = (canvas.height - 25) - this.y;
                    const timeToGround = fallDist / aimVy;
                    aimVx = targetXOffset / timeToGround;
                    aimVx = Math.max(-2.2, Math.min(2.2, aimVx));
                } else {
                    aimVx = this.vx * 0.8;
                }

                ghastFireballs.push(new GhastFireball(this.x, this.y + this.size / 2, aimVx, aimVy));
            }
        }
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 14;
        for (let i = 0; i < 6; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y, '#ffffff'));
        }
        return this.health <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const s = this.size;

        const flashing = this.hitEffectTimer > 0 && Math.floor(this.hitEffectTimer / 3) % 2 === 0;

        ctx.fillStyle = this.fireChargeTimer > 0 ? '#ffcccc' : (flashing ? '#ffffff' : '#f8f8fa');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);

        ctx.fillStyle = this.fireChargeTimer > 0 ? '#ff0000' : '#111111';
        // Eyes
        ctx.fillRect(-s * 0.25, -s * 0.15, s * 0.18, s * 0.22);
        ctx.fillRect(s * 0.07, -s * 0.15, s * 0.18, s * 0.22);

        // Mouth
        if (this.mouthOpen || this.fireChargeTimer > 0) {
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(-s * 0.2, s * 0.15, s * 0.4, s * 0.3);
            ctx.strokeRect(-s * 0.2, s * 0.15, s * 0.4, s * 0.3);
        } else {
            ctx.fillRect(-s * 0.2, s * 0.2, s * 0.4, s * 0.1);
        }

        // Trailing tentacles
        ctx.strokeStyle = '#e6e6ea';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) {
            const xOff = -s / 2 + (i + 0.5) * (s / 8);
            const wig = Math.sin(this.swayPhase * 1.5 + i * 0.7) * 5;
            const len = 16 + Math.abs(Math.sin(this.swayPhase * 0.8 + i)) * 12;
            ctx.beginPath();
            ctx.moveTo(xOff, s / 2);
            ctx.quadraticCurveTo(xOff + wig * 0.5, s / 2 + len * 0.5, xOff + wig, s / 2 + len);
            ctx.stroke();
        }

        ctx.restore();
    }
}

function spawnGhastFromEdge() {
    if (ghastMobs.length >= 1) return; // Only 1 bombing run ghast at a time
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -100 : canvas.width + 100;
    const ghast = new GhastMob(startX, canvas.height - 180, fromLeft);
    ghastMobs.push(ghast);
    console.log(`[Ghast] Single-pass bombing run ghast spawned at x=${startX} (fromLeft=${fromLeft})`);
}

// Level 3 — Phantoms: blue-gray aerial dive-bombers that swoop down at players
let phantomCycleFrames = 0;
let phantomActive = false;
let phantomActiveFramesLeft = 0;
const PHANTOM_DORMANT_FRAMES = 10 * 60 * 60; // 10 minutes at 60fps
const PHANTOM_ACTIVE_FRAMES = 5 * 60 * 60;   // 5 minutes at 60fps
const phantomMobs = [];

class PhantomMob {
    constructor(x, y) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 36; // Wingspan ~36px
        this.health = 4;
        this.maxHealth = 4;
        this.vx = Math.random() > 0.5 ? 0.5 : -0.5;
        this.vy = 0;
        this.wingPhase = Math.random() * Math.PI * 2;
        this.state = 'circling'; // circling, diving, climbing
        this.diveCooldown = Math.floor(Math.random() * 120) + 60;
        this.diveTarget = null;
        this.lifeTimer = Math.floor(Math.random() * 600) + 900; // 15-25s lifespan (900-1500 frames)
        this.exited = false;
        this.hitEffectTimer = 0;
    }

    update() {
        this.wingPhase += 0.25;
        this.lifeTimer--;
        if (this.lifeTimer <= 0) {
            this.exited = true;
        }

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        if (this.state === 'circling') {
            // Gentle circling at Level 3 height
            this.x += this.vx;
            this.y = this.groundY + Math.sin(this.wingPhase * 0.4) * 12;

            // Screen wrap
            if (this.x < -60) this.x = canvas.width + 60;
            if (this.x > canvas.width + 60) this.x = -60;

            // Pick a target and dive
            if (this.diveCooldown > 0) {
                this.diveCooldown--;
            } else {
                // Find nearest player
                let nearestPlayer = null;
                let minDist = Infinity;
                for (const [_, sprite] of sprites) {
                    if (sprite.isGhost) continue;
                    let diff = sprite.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    const dist = Math.abs(diff);
                    if (dist < minDist && dist < 500) {
                        minDist = dist;
                        nearestPlayer = { sprite, diff };
                    }
                }
                if (nearestPlayer) {
                    this.state = 'diving';
                    this.diveTarget = { x: nearestPlayer.sprite.x, y: nearestPlayer.sprite.y };
                    this.vx = Math.sign(nearestPlayer.diff) * 4.0; // Fast horizontal dive
                    this.vy = 5.0; // Fast vertical dive
                    this.diveCooldown = Math.floor(Math.random() * 180) + 120;
                }
            }
        } else if (this.state === 'diving') {
            // Dive straight down toward target
            this.x += this.vx;
            this.y += this.vy;

            // Check if we reached player height (ground level + some buffer)
            if (this.y >= canvas.height - 50) {
                // At ground level - deal damage and start climbing back up
                for (const [_, sprite] of sprites) {
                    if (sprite.isGhost) continue;
                    let diff = sprite.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    if (Math.abs(diff) < 30 && Math.abs(sprite.y - this.y) < 40) {
                        const damage = 25; // Light damage (4 hits to kill)
                        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                            wsInstance.send(JSON.stringify({ type: 'PHANTOM_ATTACK', target: sprite.username, damage }));
                        }
                        sprite.hurt();
                        // Purple/blue dive impact particles
                        for (let i = 0; i < 6; i++) {
                            bloodParticles.push(new BloodParticle(sprite.x, sprite.y, '#8a2be2'));
                        }
                        break;
                    }
                }
                this.state = 'climbing';
                this.vy = -3.5; // Climb back up
                this.vx *= 0.5; // Slow horizontal
            }
        } else if (this.state === 'climbing') {
            // Climb back up to circling height
            this.x += this.vx;
            this.y += this.vy;
            if (this.y <= this.groundY + 20) {
                this.y = this.groundY;
                this.state = 'circling';
                this.vx = Math.random() > 0.5 ? 0.5 : -0.5;
                this.vy = 0;
            }
        }
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 12;
        for (let i = 0; i < 5; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y, '#8a2be2'));
        }
        return this.health <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const flashing = this.hitEffectTimer > 0 && Math.floor(this.hitEffectTimer / 3) % 2 === 0;

        // Body (flat blue-gray phantom shape)
        const s = this.size;
        ctx.fillStyle = flashing ? '#a0a0c0' : '#6b6b9e';
        ctx.strokeStyle = '#3a3a5e';
        ctx.lineWidth = 2;

        // Wing flap animation
        const wingAngle = Math.sin(this.wingPhase) * 0.8; // Wing tilt

        // Left wing
        ctx.beginPath();
        ctx.moveTo(-2, -2);
        ctx.lineTo(-s * 0.6, -s * 0.3 * Math.cos(wingAngle));
        ctx.lineTo(-s * 0.4, s * 0.1);
        ctx.lineTo(-2, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right wing
        ctx.beginPath();
        ctx.moveTo(2, -2);
        ctx.lineTo(s * 0.6, -s * 0.3 * Math.cos(-wingAngle));
        ctx.lineTo(s * 0.4, s * 0.1);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Body (narrow vertical)
        ctx.fillRect(-4, -6, 8, 14);

        // Glowing teal/green eyes
        ctx.fillStyle = flashing ? '#ffffff' : '#00ffcc';
        ctx.fillRect(-6, -4, 4, 4);
        ctx.fillRect(2, -4, 4, 4);

        ctx.restore();
    }
}

function spawnPhantomFromEdge() {
    if (phantomMobs.length >= 3) return; // Max 3 phantoms at once
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -80 : canvas.width + 80;
    const count = Math.floor(Math.random() * 3) + 1; // 1-3 phantoms
    for (let i = 0; i < count; i++) {
        const x = startX + (Math.random() - 0.5) * 60;
        const phantom = new PhantomMob(x, canvas.height - 190); // Level 3 height
        phantomMobs.push(phantom);
    }
    console.log(`[Phantom] ${count} phantom(s) spawned at x=${startX}`);
}

function spawnZombieFromEdge() {
    if (slimeMobs.length + creeperMobs.length + zombieMobs.length >= 8) return;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -80 : canvas.width + 80;
    const targetX = Math.random() * (canvas.width - 240) + 120;
    const zombie = new ZombieMob(startX, canvas.height - 25);
    zombie.targetX = targetX;
    zombie.startX = startX;
    zombie.state = 'entering';
    zombieMobs.push(zombie);
    console.log(`[Zombie] Spawned offscreen at x=${startX}, walking to x=${targetX}`);
}

// Spawn a big slime, starting visibly on screen
let slimeSpawnTimer = 0;
let creeperSpawnTimer = 0;
let zombieSpawnTimer = 0;
function spawnSlimeFromEdge() {
    const fromLeft = Math.random() > 0.5;
    // Add small random offset so multiple slimes don't spawn at exact same offscreen coordinate
    const offsetX = (Math.random() - 0.5) * 30;
    const startX = (fromLeft ? -80 : canvas.width + 80) + offsetX;
    const targetX = Math.random() * (canvas.width - 240) + 120;
    const slime = new SlimeMob(startX, canvas.height - 25, 'big');
    slime.targetX = targetX;
    slime.startX = startX;
    slime.totalDist = Math.abs(targetX - startX);
    slime.hopCount = Math.max(2, Math.round(slime.totalDist / 70));
    slime.state = 'entering';
    // Stagger initial movement slightly
    slime.stateTimer = Math.floor(Math.random() * 20);
    slimeMobs.push(slime);
    console.log(`[Slime] Big slime spawned offscreen at x=${startX}, hopping to x=${targetX}`);
}

// Click/tap a slime, creeper, or zombie to damage it (players can defend themselves)
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Hit-test phantoms first (Level 3 aerial - highest mobs)
    for (let i = phantomMobs.length - 1; i >= 0; i--) {
        const p = phantomMobs[i];
        const half = p.size / 2;
        if (mx >= p.x - half && mx <= p.x + half && my >= p.y - p.size && my <= p.y) {
            const killed = p.hurt(2);
            if (killed) {
                phantomMobs.splice(i, 1);
            }
            return;
        }
    }
    // Hit-test ghasts (Level 3 - high mob)
    for (let i = ghastMobs.length - 1; i >= 0; i--) {
        const g = ghastMobs[i];
        const half = g.size / 2;
        if (mx >= g.x - half && mx <= g.x + half && my >= g.y - g.size && my <= g.y) {
            const killed = g.hurt(2);
            if (killed) {
                ghastMobs.splice(i, 1);
            }
            return;
        }
    }
    // Hit-test zombies
    for (let i = zombieMobs.length - 1; i >= 0; i--) {
        const z = zombieMobs[i];
        const half = z.size / 2;
        if (mx >= z.x - half && mx <= z.x + half && my >= z.y - 58 && my <= z.y) {
            const killed = z.hurt(2);
            if (killed) {
                zombieMobs.splice(i, 1);
            }
            return;
        }
    }
    // Hit-test creepers
    for (let i = creeperMobs.length - 1; i >= 0; i--) {
        const c = creeperMobs[i];
        const half = c.size / 2;
        if (mx >= c.x - half && mx <= c.x + half && my >= c.y - c.size && my <= c.y) {
            const killed = c.hurt(2);
            if (killed) {
                creeperMobs.splice(i, 1);
            }
            return;
        }
    }
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
    } else if (type === 'BUFF_DROP_SPAWN' || type === 'DIAMOND_DROP_SPAWN') {
        activeDiamondDrop = new MinecraftDiamondDrop(x || (Math.random() * (canvas.width - 200) + 100));
        diamondDrops.push(activeDiamondDrop);
        console.log(`[Client] Minecraft Diamond drop spawned at x=${x}`);
    } else if (type === 'BUFF_CLAIMED' || type === 'DIAMOND_CLAIMED') {
        if (activeDiamondDrop) {
            activeDiamondDrop.claimed = true;
            activeDiamondDrop.claimTime = Date.now();
        }
        const key = user ? user.toLowerCase() : '';
        if (sprites.has(key)) {
            sprites.get(key).setBuffGlow(true);
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
        phantomActive = false;
        phantomCycleFrames = 0;
        phantomActiveFramesLeft = 0;
        for (const p of phantomMobs) {
            p.exited = true;
        }
        phantomMobs.length = 0;
        console.log(`[Sleep] !sleep command received - Phantoms put to sleep and cycle reset.`);
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

    // Surface Mob Wave Spawner (5–10 min, packs of 1–3 mixed mobs)
    if (!window.nextSurfaceMobSpawnIn) {
        window.nextSurfaceMobSpawnIn = Math.floor(Math.random() * 18000) + 18000; // 5–10 min @ 60fps
    }
    if (!window.surfaceMobSpawnTimer) window.surfaceMobSpawnTimer = 0;
    if (++window.surfaceMobSpawnTimer >= window.nextSurfaceMobSpawnIn) {
        window.surfaceMobSpawnTimer = 0;
        window.nextSurfaceMobSpawnIn = Math.floor(Math.random() * 18000) + 18000;
        const totalMobs = slimeMobs.length + creeperMobs.length + zombieMobs.length;
        if (totalMobs < 8) {
            const packSize = Math.floor(Math.random() * 3) + 1; // 1–3 mobs
            console.log(`[Surface Mobs] Spawning wave of ${packSize} mob(s)!`);
            for (let i = 0; i < packSize; i++) {
                const roll = Math.random();
                if (roll < 0.35) {
                    spawnSlimeFromEdge();
                } else if (roll < 0.7) {
                    spawnCreeperFromEdge();
                } else {
                    spawnZombieFromEdge();
                }
            }
        }
    }

    // Slime Mobs — update, draw, cleanup
    for (let i = slimeMobs.length - 1; i >= 0; i--) {
        const s = slimeMobs[i];
        s.update();
        s.draw(ctx);
        if (s.health <= 0 || s.exited) {
            slimeMobs.splice(i, 1);
        }
    }

    // Creeper Mobs — update, draw, explosions, cleanup
    for (let i = creeperMobs.length - 1; i >= 0; i--) {
        const c = creeperMobs[i];
        c.update();
        c.draw(ctx);
        if (c.health <= 0 || c.exited) {
            creeperMobs.splice(i, 1);
        }
    }
    for (let i = creeperExplosions.length - 1; i >= 0; i--) {
        const exp = creeperExplosions[i];
        exp.update();
        exp.draw(ctx);
        if (exp.isDead()) {
            creeperExplosions.splice(i, 1);
        }
    }

    // Zombie Mobs — update, draw, cleanup
    for (let i = zombieMobs.length - 1; i >= 0; i--) {
        const z = zombieMobs[i];
        z.update();
        z.draw(ctx);
        if (z.health <= 0 || z.exited) {
            zombieMobs.splice(i, 1);
        }
    }

    // Ghast Mobs (Level 3 floating) — update + draw + cleanup
    for (let i = ghastMobs.length - 1; i >= 0; i--) {
        const g = ghastMobs[i];
        g.update();
        g.draw(ctx);
        if (g.health <= 0 || g.exited) {
            ghastMobs.splice(i, 1);
        }
    }

    // Ghast Auto-Spawn Timer (~45 min intervals, one at a time)
    if (!window.nextGhastSpawnIn) {
        window.nextGhastSpawnIn = 45 * 60 * 60; // 45 minutes @ 60fps = 162,000 frames
        window.ghastSpawnTimer = 0;
    }
    if (++window.ghastSpawnTimer >= window.nextGhastSpawnIn) {
        window.ghastSpawnTimer = 0;
        window.nextGhastSpawnIn = Math.floor(Math.random() * 18000) + 162000; // ~45 min ± 5 min
        if (ghastMobs.length === 0) {
            spawnGhastFromEdge();
            console.log(`[Ghast] Auto-spawned on 45-min timer!`);
        }
    }

    // Ghast Fireballs — update + draw + cleanup
    for (let i = ghastFireballs.length - 1; i >= 0; i--) {
        const fb = ghastFireballs[i];
        fb.update();
        if (!fb.exited) {
            fb.draw(ctx);
        } else {
            ghastFireballs.splice(i, 1);
        }
    }

    // Phantom Mobs (Level 3 aerial dive-bombers) — cycle manager (10 min dormant, 5 min active) & update
    if (!phantomActive) {
        phantomCycleFrames++;
        if (phantomCycleFrames >= PHANTOM_DORMANT_FRAMES) {
            phantomCycleFrames = 0;
            phantomActive = true;
            phantomActiveFramesLeft = PHANTOM_ACTIVE_FRAMES;
            spawnPhantomFromEdge();
            console.log(`[Phantom Cycle] Phantoms arrived! Active for 5 minutes.`);
        }
    } else {
        phantomActiveFramesLeft--;
        if (phantomMobs.length === 0 && Math.random() < 0.0005) {
            spawnPhantomFromEdge();
        }
        if (phantomActiveFramesLeft <= 0) {
            phantomActive = false;
            phantomCycleFrames = 0;
            for (const p of phantomMobs) {
                p.exited = true;
            }
            console.log(`[Phantom Cycle] Phantoms retreated. Next spawn in 10 minutes.`);
        }
    }

    for (let i = phantomMobs.length - 1; i >= 0; i--) {
        const p = phantomMobs[i];
        p.update();
        p.draw(ctx);
        if (p.health <= 0 || p.exited) {
            phantomMobs.splice(i, 1);
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

    // Diamond drop particles (update + draw, remove dead/claimed ones)
    for (let i = diamondDrops.length - 1; i >= 0; i--) {
        const p = diamondDrops[i];
        if (p.update()) {
            p.draw(ctx);
        } else {
            diamondDrops.splice(i, 1);
            if (p === activeDiamondDrop) activeDiamondDrop = null;
        }
    }

    requestAnimationFrame(animate);
}

connectWS();
animate();