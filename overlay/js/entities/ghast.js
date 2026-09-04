import { canvas } from '../core/canvas.js';
import { bloodParticles } from '../core/state.js';
import { BloodParticle } from '../particles/blood.js';

export class GhastFireball {
    constructor(x, y, vx = 0, vy = 2.5) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = 16;
        this.exited = false;
        this.animPhase = Math.random() * Math.PI * 2;
    }
    update(sprites, wsInstance) {
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
                const damage = 50;
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

        const flamePulse = Math.sin(this.animPhase) * 3;
        
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(0, 0, this.size + flamePulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff9900';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.7 + flamePulse * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffff66';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class GhastMob {
    constructor(x, y, fromLeft) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 85;
        this.health = 8;
        this.maxHealth = 8;
        this.fromLeft = fromLeft;
        this.vx = fromLeft ? 0.8 : -0.8;
        this.fireCooldown = Math.floor(Math.random() * 80) + 40;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.hitEffectTimer = 0;
        this.exited = false;
        this.mouthOpen = false;
        this.fireChargeTimer = 0;
    }

    update(sprites, ghastFireballs, wsInstance) {
        this.swayPhase += 0.025;
        this.y = this.groundY + Math.sin(this.swayPhase) * 6;

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        this.x += this.vx;
        if (this.fromLeft && this.x > canvas.width) {
            this.exited = true;
        } else if (!this.fromLeft && this.x < 0) {
            this.exited = true;
        }

        if (this.fireCooldown > 0) {
            this.fireCooldown--;
        } else {
            this.mouthOpen = true;
            this.fireChargeTimer = 40;
            this.fireCooldown = Math.floor(Math.random() * 60) + 180;
        }

        if (this.fireChargeTimer > 0) {
            this.fireChargeTimer--;
            if (this.fireChargeTimer === 0) {
                this.mouthOpen = false;

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
        ctx.fillRect(-s * 0.25, -s * 0.15, s * 0.18, s * 0.22);
        ctx.fillRect(s * 0.07, -s * 0.15, s * 0.18, s * 0.22);

        if (this.mouthOpen || this.fireChargeTimer > 0) {
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(-s * 0.2, s * 0.15, s * 0.4, s * 0.3);
            ctx.strokeRect(-s * 0.2, s * 0.15, s * 0.4, s * 0.3);
        } else {
            ctx.fillRect(-s * 0.2, s * 0.2, s * 0.4, s * 0.1);
        }

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
