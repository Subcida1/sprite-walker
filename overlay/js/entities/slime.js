import { canvas } from '../core/canvas.js';
import { bloodParticles } from '../core/state.js';
import { BloodParticle } from '../particles/blood.js';

export class SlimeMob {
    constructor(x, y, tier = 'big') {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.tier = tier;

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

        this.state = 'idle';
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
        this.hopPhase = Math.random() * Math.PI * 2;
        this.stateTimer = Math.floor(Math.random() * 30) + 10;
        this.age = 0;
        this.nextHuntFrame = 36000 + Math.floor(Math.random() * 7200);
        this.forcedHuntActive = false;
    }

    update(slimeMobs, sprites, wsInstance) {
        this.groundY = canvas.height - 25;
        this.age++;
        if (this.age >= 18000) {
            this.exited = true;
        }

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

        if (!this.attackCooldown) this.attackCooldown = 0;
        if (this.attackCooldown > 0) this.attackCooldown--;

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
                        this.attackCooldown = 1800;
                        break;
                    }
                }
            }
        }

        let nearest = null;
        let minDist = Infinity;
        for (const [key, sprite] of sprites) {
            if (sprite.isGhost) continue;
            let diff = sprite.x - this.x;
            if (diff > canvas.width / 2) diff -= canvas.width;
            if (diff < -canvas.width / 2) diff += canvas.width;
            const dist = Math.abs(diff);
            if (dist < minDist) {
                minDist = dist;
                nearest = { sprite, diff };
            }
        }

        if (this.state === 'idle') {
            this.squashX += (1 - this.squashX) * 0.15;
            this.squashY += (1 - this.squashY) * 0.15;
            if (this.stateTimer > 0) {
                this.stateTimer--;
            } else {
                this.state = 'hopping';
                const distRange = 120 + Math.random() * 200;
                const dir = Math.random() > 0.5 ? 1 : -1;
                this.targetX = this.x + dir * distRange;
                this.startX = this.x;
                this.totalDist = Math.abs(this.targetX - this.startX);
                const desiredHopLength = 70;
                this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
                this.hopPhase = 0;
            }
        } else if (this.state === 'hopping') {
            this.hopPhase += 0.07 * (this.speed / 0.9);
            if (this.hopPhase >= Math.PI) {
                this.hopPhase = 0;
                this.x = this.targetX;
                this.state = 'idle';
                this.stateTimer = Math.floor(Math.random() * 90) + 40;
                this.squashX = 1.3;
                this.squashY = 0.7;
            } else {
                const progress = this.hopPhase / Math.PI;
                const dx = this.targetX - this.startX;
                this.facingRight = dx > 0;
                this.x = this.startX + dx * progress;
                const hopHeight = this.size * 0.75;
                this.y = this.groundY - Math.sin(this.hopPhase) * hopHeight;
                if (progress < 0.2) {
                    this.squashX = 0.82;
                    this.squashY = 1.22;
                } else if (progress > 0.8) {
                    this.squashX = 1.25;
                    this.squashY = 0.8;
                } else {
                    this.squashX = 1.0;
                    this.squashY = 1.0;
                }
            }
        }

        if (this.x < -100) this.x = canvas.width + 100;
        if (this.x > canvas.width + 100) this.x = -100;
    }

    hurt(amount) {
        this.health -= amount;
        this.hitEffectTimer = 14;
        for (let i = 0; i < 6; i++) {
            bloodParticles.push(new BloodParticle(this.x, this.y - this.size / 2, '#2ecc71'));
        }
        return this.health <= 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const size = this.size;
        const halfSize = size / 2;

        ctx.scale(this.squashX, this.squashY);

        ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, size * (1 - this.squashY) * 0.5, halfSize * 0.9, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(46, 204, 113, 0.82)';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.fillRect(-halfSize, -size, size, size);
        ctx.strokeRect(-halfSize, -size, size, size);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(-halfSize + 4, -size + 4, size * 0.35, size * 0.25);
        ctx.fillRect(-halfSize + 4, -size + size * 0.35, size * 0.2, size * 0.4);

        ctx.fillStyle = '#2ecc71';
        const inner = size * 0.6;
        ctx.fillRect(-inner / 2, -size * 0.8, inner, inner);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(-halfSize, -size, size, size);

        const eyeSize = Math.max(4, size * 0.14);
        const eyeY = -size * 0.6;
        const dir = this.facingRight ? 1 : -1;
        ctx.fillStyle = '#000000';
        const eyeOffset = size * 0.28;
        
        ctx.fillRect(dir * eyeOffset - eyeSize / 2, eyeY, eyeSize, eyeSize * 1.5);
        ctx.fillRect(dir * eyeOffset * 0.3 - eyeSize / 2, eyeY, eyeSize, eyeSize * 1.5);
        ctx.fillRect(-size * 0.25, -size * 0.35, size * 0.5, eyeSize);

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
