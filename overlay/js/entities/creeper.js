import { canvas } from '../core/canvas.js';
import { state } from '../core/state.js';
import { bloodParticles } from '../core/state.js';
import { BloodParticle } from '../particles/blood.js';

export class CreeperExplosion {
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
            p.vy += 0.08;
            p.vx *= 0.98;
            p.alpha = Math.max(0, p.alpha - p.decay);
            p.size *= 1.01;
        }
        return this.particles.some(p => p.alpha > 0);
    }
    draw(ctx) {
        for (const p of this.particles) {
            if (p.alpha <= 0) continue;
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
    isDead() {
        return this.particles.every(p => p.alpha <= 0);
    }
}

export class CreeperMob {
    constructor(x, y) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 30;
        this.health = 3;
        this.maxHealth = 3;
        this.damage = 3;
        this.speed = 1.0;

        this.state = 'entering';
        this.stateTimer = Math.floor(Math.random() * 90) + 30;
        this.startX = x;
        this.targetX = x;
        this.facingRight = Math.random() > 0.5;
        this.hitEffectTimer = 0;
        this.exited = false;

        this.fuseTimer = 0;
        this.maxFuse = 90;
        this.age = 0;
    }

    update(slimeMobs, creeperMobs, sprites, wsInstance) {
        this.groundY = canvas.height - 25;
        this.age++;
        if (this.age >= 18000) {
            this.exited = true;
        }

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
                this.stateTimer = Math.floor(Math.random() * 180) + 90;
            }
        } else if (this.state === 'wandering') {
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

            if (nearestPlayer && minPlayerDist <= 60 && this.state !== 'fusing') {
                this.state = 'fusing';
                this.fuseTimer = this.maxFuse;
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
                    this.x += Math.sign(dx) * Math.min(this.speed * 0.9, Math.abs(dx));
                }
            }
        } else if (this.state === 'fusing') {
            this.fuseTimer--;
            if (this.fuseTimer <= 0) {
                this.explode(sprites, wsInstance);
            }
        }

        if (this.x < -60 || this.x > canvas.width + 60) {
            this.exited = true;
        }
    }

    explode(sprites, wsInstance) {
        state.creeperExplosions.push(new CreeperExplosion(this.x, this.y - 24));
        for (const [_, sprite] of sprites) {
            if (sprite.isGhost) continue;
            let diff = sprite.x - this.x;
            if (diff > canvas.width / 2) diff -= canvas.width;
            if (diff < -canvas.width / 2) diff += canvas.width;
            if (Math.abs(diff) < 100) {
                if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                    wsInstance.send(JSON.stringify({ type: 'CREEPER_EXPLOSION', target: sprite.username, damage: 40 }));
                }
                sprite.hurt();
                for (let i = 0; i < 8; i++) {
                    bloodParticles.push(new BloodParticle(sprite.x, sprite.y, '#55ff55'));
                }
            }
        }
        this.exited = true;
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 14;
        for (let i = 0; i < 6; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y - 30, '#55ff55'));
        }
        if (this.health <= 0) {
            this.exited = true;
            return true;
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const flashing = this.hitEffectTimer > 0 && Math.floor(this.hitEffectTimer / 3) % 2 === 0;
        const isFusing = this.state === 'fusing';
        const swell = isFusing ? Math.max(0, Math.sin((this.maxFuse - this.fuseTimer) * 0.2) * 4) : 0;
        const blink = isFusing && Math.floor((this.maxFuse - this.fuseTimer) / 4) % 2 === 0;

        ctx.fillStyle = flashing ? '#ffffff' : '#5aa35a';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;

        const headW = 28 + swell;
        const headH = 28 + swell;
        const bodyW = 22;
        const bodyH = 28;
        const legW = 8;
        const legH = 16;

        ctx.fillRect(-bodyW / 2, legH - bodyH + swell / 2, bodyW, bodyH);
        ctx.strokeRect(-bodyW / 2, legH - bodyH + swell / 2, bodyW, bodyH);

        ctx.fillRect(-legW, 0, legW, legH);
        ctx.strokeRect(-legW, 0, legW, legH);
        ctx.fillRect(0, 0, legW, legH);
        ctx.strokeRect(0, 0, legW, legH);

        ctx.fillRect(-headW / 2, legH - bodyH - headH + swell / 2, headW, headH);
        ctx.strokeRect(-headW / 2, legH - bodyH - headH + swell / 2, headW, headH);

        const eyeColor = blink ? '#ff0000' : '#000000';
        ctx.fillStyle = eyeColor;
        ctx.fillRect(-8, legH - bodyH - headH + 8 + swell / 2, 6, 6);
        ctx.fillRect(2, legH - bodyH - headH + 8 + swell / 2, 6, 6);
        ctx.fillRect(-4, legH - bodyH - headH + 18 + swell / 2, 8, 6);
        ctx.restore();
    }
}