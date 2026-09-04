import { canvas } from '../core/canvas.js';
import { bloodParticles } from '../core/state.js';
import { BloodParticle } from '../particles/blood.js';

export class ZombieMob {
    constructor(x, y) {
        this.x = x;
        this.groundY = y;
        this.y = y;
        this.size = 28;
        this.health = 3;
        this.maxHealth = 3;
        this.damage = 30;
        this.speed = 0.8;

        this.state = 'entering';
        this.stateTimer = Math.floor(Math.random() * 90) + 30;
        this.startX = x;
        this.targetX = x;
        this.facingRight = Math.random() > 0.5;
        this.hitEffectTimer = 0;
        this.exited = false;
        this.shamblePhase = 0;
        this.attackCooldown = 0;
        this.age = 0;
    }

    update(slimeMobs, creeperMobs, zombieMobs, sprites, wsInstance) {
        this.groundY = canvas.height - 25;
        this.y = this.groundY;
        this.age++;
        if (this.age >= 18000) {
            this.exited = true;
        }

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
                this.attackCooldown = 120;
                if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                    wsInstance.send(JSON.stringify({ type: 'ZOMBIE_ATTACK', target: nearestPlayer.username, damage: 30 }));
                }
                nearestPlayer.hurt();
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

        const leanPeak = Math.sin(this.shamblePhase * 0.5) * 0.15;
        const lean = isMoving ? (this.facingRight ? -Math.abs(leanPeak) * 0.6 - 0.05 : Math.abs(leanPeak) * 0.6 + 0.05) : 0;
        ctx.rotate(lean);

        const legSwing = isMoving ? Math.sin(this.shamblePhase) * 5 : 0;
        const bodyBob = isMoving ? Math.abs(Math.sin(this.shamblePhase * 2)) * 2.5 : 0;

        const feetHeight = 14;
        const bodyWidth = 20;
        const bodyHeight = 22;
        const armReach = 16;
        const dir = this.facingRight ? 1 : -1;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;

        ctx.fillStyle = flashing ? '#ffffff' : '#1e3f66';
        ctx.fillRect(-11 + legSwing * 0.7, -feetHeight + Math.max(0, legSwing) * 0.5, 9, feetHeight - Math.max(0, legSwing) * 0.5);
        ctx.strokeRect(-11 + legSwing * 0.7, -feetHeight + Math.max(0, legSwing) * 0.5, 9, feetHeight - Math.max(0, legSwing) * 0.5);
        ctx.fillRect(2 - legSwing * 0.7, -feetHeight + Math.max(0, -legSwing) * 0.5, 9, feetHeight - Math.max(0, -legSwing) * 0.5);
        ctx.strokeRect(2 - legSwing * 0.7, -feetHeight + Math.max(0, -legSwing) * 0.5, 9, feetHeight - Math.max(0, -legSwing) * 0.5);

        const bodyY = -feetHeight - bodyHeight - bodyBob;
        ctx.fillStyle = flashing ? '#a0e0e0' : '#007a7a';
        ctx.fillRect(-bodyWidth / 2, bodyY, bodyWidth, bodyHeight);
        ctx.strokeRect(-bodyWidth / 2, bodyY, bodyWidth, bodyHeight);

        ctx.fillStyle = flashing ? '#ffffff' : '#3c8527';
        const armY = bodyY + 3;
        ctx.fillRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY, armReach, 8);
        ctx.strokeRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY, armReach, 8);
        ctx.fillRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY + 9, armReach - 3, 7);
        ctx.strokeRect(dir > 0 ? bodyWidth / 2 - 2 : -bodyWidth / 2 - armReach + 2, armY + 9, armReach - 3, 7);

        const headSize = 24;
        const headY = bodyY - headSize;
        ctx.fillStyle = flashing ? '#ffffff' : '#3c8527';
        ctx.fillRect(-headSize / 2, headY, headSize, headSize);
        ctx.strokeRect(-headSize / 2, headY, headSize, headSize);

        ctx.fillStyle = '#000000';
        ctx.fillRect(dir * 4 - 3, headY + 7, 4, 4);
        ctx.fillRect(dir * -2 - 3, headY + 7, 4, 4);
        ctx.fillRect(-2, headY + 15, 5, 3);

        ctx.restore();
    }
}
