import { canvas } from '../core/canvas.js';
import { state } from '../core/state.js';
import { BloodParticle } from '../particles/blood.js';

export class PhantomMob {
    constructor(x, y) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 36;
        this.health = 4;
        this.maxHealth = 4;
        this.vx = Math.random() > 0.5 ? 0.5 : -0.5;
        this.vy = 0;
        this.wingPhase = Math.random() * Math.PI * 2;
        this.state = 'circling';
        this.diveCooldown = Math.floor(Math.random() * 120) + 60;
        this.diveTarget = null;
        this.lifeTimer = Math.floor(Math.random() * 600) + 900;
        this.exited = false;
        this.hitEffectTimer = 0;
    }

    update(sprites, wsInstance) {
        this.wingPhase += 0.25;
        this.lifeTimer--;
        if (this.lifeTimer <= 0) {
            this.exited = true;
        }

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;

        if (this.state === 'circling') {
            this.x += this.vx;
            this.y = this.groundY + Math.sin(this.wingPhase * 0.4) * 12;

            if (this.x < -60) this.x = canvas.width + 60;
            if (this.x > canvas.width + 60) this.x = -60;

            if (this.diveCooldown > 0) {
                this.diveCooldown--;
            } else {
                let nearest = null;
                let minDist = Infinity;
                for (const [_, sprite] of sprites) {
                    if (sprite.isGhost) continue;
                    let diff = sprite.x - this.x;
                    if (diff > canvas.width / 2) diff -= canvas.width;
                    if (diff < -canvas.width / 2) diff += canvas.width;
                    const dist = Math.abs(diff);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = sprite;
                    }
                }
                if (nearest && minDist < 350) {
                    this.state = 'diving';
                    this.diveTarget = nearest;
                } else {
                    this.diveCooldown = 90;
                }
            }
        } else if (this.state === 'diving') {
            if (!this.diveTarget || this.diveTarget.isGhost) {
                this.state = 'circling';
                this.diveCooldown = 120;
                return;
            }

            let diff = this.diveTarget.x - this.x;
            if (diff > canvas.width / 2) diff -= canvas.width;
            if (diff < -canvas.width / 2) diff += canvas.width;

            this.x += Math.sign(diff) * 1.8;
            this.y += 2.2;

            const targetFloor = canvas.height - 25;
            if (this.y >= targetFloor - 20 || Math.abs(diff) < 25) {
                if (Math.abs(diff) < 40) {
                    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                        wsInstance.send(JSON.stringify({ type: 'PHANTOM_SWOOP', target: this.diveTarget.username, damage: 20 }));
                    }
                    this.diveTarget.hurt();
                    for (let i = 0; i < 5; i++) {
                        state.bloodParticles.push(new BloodParticle(this.diveTarget.x, this.diveTarget.y, '#3b5998'));
                    }
                }
                this.state = 'climbing';
            }
        } else if (this.state === 'climbing') {
            this.y -= 2.0;
            this.x += this.vx * 1.5;
            if (this.y <= this.groundY - 120) {
                this.state = 'circling';
                this.diveCooldown = Math.floor(Math.random() * 180) + 120;
            }
        }
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 14;
        for (let i = 0; i < 6; i++) {
            state.bloodParticles.push(new BloodParticle(this.x, this.y, '#818cf8'));
        }
        return this.health <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const flashing = this.hitEffectTimer > 0 && Math.floor(this.hitEffectTimer / 3) % 2 === 0;
        const wingFlap = Math.sin(this.wingPhase * 1.5) * 14;

        ctx.fillStyle = flashing ? '#ffffff' : '#3b5998';
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(-this.size, -wingFlap);
        ctx.lineTo(-this.size * 0.5, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(this.size, -wingFlap);
        ctx.lineTo(this.size * 0.5, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = flashing ? '#ffffff' : '#4f46e5';
        ctx.fillRect(-6, -6, 12, 14);
        ctx.strokeRect(-6, -6, 12, 14);

        ctx.fillStyle = '#00ffff';
        ctx.fillRect(-4, -4, 3, 3);
        ctx.fillRect(1, -4, 3, 3);

        ctx.restore();
    }
}
