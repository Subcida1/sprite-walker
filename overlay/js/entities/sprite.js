import { canvas } from '../core/canvas.js';
import { getAvatarImage } from '../core/assets.js';
import { state } from '../core/state.js';
import { BloodParticle } from '../particles/blood.js';
import { GhostParticle } from '../particles/ghost.js';

export class Sprite {
    constructor(username, mcUser, health = 100, maxHealth = 100, isGhost = false, killStreak = 0, isEnhanced = false) {
        this.username = username;
        this.mcUser = mcUser || username;
        
        this.health = health;
        this.maxHealth = maxHealth;
        this.pendingHealth = health;
        this.pendingMaxHealth = maxHealth;
        this.isGhost = isGhost;
        this.pendingGhost = false;
        
        this.killStreak = killStreak;
        this.isEnhanced = isEnhanced;
        this.killStreakTimer = 0;
        
        this.buffGlow = false;
        this.buffGlowTimer = 0;
        
        this.hurtPhrase = '💥 Ouch!';

        this.ascending = false;
        this.ascensionStartTime = 0;
        this.ascensionDuration = 3500;
        this.ascensionStartY = 0;
        this.ascensionTargetY = 0;

        this.nudgeTargetX = null;
        this.nudgeExpiresAt = 0;
        
        this.groundY = canvas.height - 60;
        
        let hash = 0;
        for (let i = 0; i < this.username.length; i++) {
            hash = (hash * 31 + this.username.charCodeAt(i)) % 1000;
        }
        const userFactor = hash / 1000;
        this.targetX = 60 + userFactor * (canvas.width - 120);
        this.targetX += Math.random() * 60 - 30;
        this.targetX = Math.max(50, Math.min(canvas.width - 50, this.targetX));
        
        this.enterDirection = this.targetX < canvas.width / 2 ? 'left' : 'right';
        this.x = this.enterDirection === 'left' ? -40 : canvas.width + 40;
        this.y = this.groundY;
        
        this.startX = this.x;
        this.totalDist = Math.abs(this.targetX - this.startX);
        const desiredHopLength = 60;
        this.hopCount = Math.max(1, Math.round(this.totalDist / desiredHopLength));
        this.speed = 1.0;
        this.state = 'entering';
        this.stateTimer = 0;
        this.attackTarget = null;
        this.originalX = this.targetX;

        this.facingRight = true;
        this.hitEffectTimer = 0;

        this.ghostTargetX = null;
        this.ghostWaitTimer = 0;

        this.currentSquashX = 1;
        this.currentSquashY = 1;

        this.lastDamageTime = Date.now();
        this.lastHealTime = Date.now();
    }

    update() {
        const bottomMinY = canvas.height * 0.82;
        const bottomMaxY = canvas.height - 25;
        this.groundY = bottomMaxY;

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

        if (this.state === 'exiting') {
            const edgeX = this.enterDirection === 'right' ? canvas.width + 60 : -60;
            const dx = edgeX - this.x;
            this.facingRight = dx > 0;
            if (Math.abs(dx) > 1.5) {
                this.x += Math.sign(dx) * Math.min(1.8, Math.abs(dx));
                const traveled = Math.abs(this.x - this.startX);
                const progress = Math.min(1, traveled / this.totalDist);
                this.y = this.groundY - Math.abs(Math.sin(progress * Math.PI * this.hopCount)) * 14;
            } else {
                this.exited = true;
            }
            if (this.hitEffectTimer > 0) this.hitEffectTimer--;
            return;
        }

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
            this.lastDamageTime = Date.now();
            this.lastHealTime = Date.now();
        }

        if (this.isGhost) {
            const ghostHoverY = bottomMaxY - 40;
            if (this.ascending) {
                const elapsed = Date.now() - this.ascensionStartTime;
                const progress = Math.min(1, elapsed / this.ascensionDuration);
                const eased = 1 - Math.pow(1 - progress, 3);
                this.y = this.ascensionStartY + (ghostHoverY - this.ascensionStartY) * eased;
                
                if (progress >= 1) {
                    this.ascending = false;
                }
            } else {
                if (!this.ghostTargetX) {
                    this.ghostTargetX = Math.random() * (canvas.width + 200) - 100;
                    this.ghostWaitTimer = 0;
                }

                if (this.ghostWaitTimer > 0) {
                    this.ghostWaitTimer--;
                } else {
                    const dx = this.wrappedDiff(this.ghostTargetX, this.x);
                    if (Math.abs(dx) > 1.5) {
                        this.facingRight = dx > 0;
                        this.x += Math.sign(dx) * Math.min(1.1, Math.abs(dx));
                        this.x = this.wrapX(this.x);
                    } else {
                        this.x = this.ghostTargetX;
                        this.ghostTargetX = null;
                        this.ghostWaitTimer = Math.floor(Math.random() * 180) + 90;
                    }
                }
            }
            this.y = Math.min(this.y, ghostHoverY);
        } else {
            this.y = this.groundY;
            if (this.killStreak >= 3) {
                this.isEnhanced = true;
            }
            if (this.isEnhanced) {
                this.killStreakTimer++;
                if (this.killStreakTimer >= 600) {
                    this.isEnhanced = false;
                    this.killStreak = 0;
                    this.killStreakTimer = 0;
                }
            }
        }

        if (this.hitEffectTimer > 0) this.hitEffectTimer--;
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.nudgeTargetX !== null && Date.now() > this.nudgeExpiresAt) {
            this.nudgeTargetX = null;
        }

        if (this.pendingHealth !== this.health || this.pendingMaxHealth !== this.maxHealth || this.pendingGhost !== this.isGhost) {
            this.health = this.pendingHealth;
            this.maxHealth = this.pendingMaxHealth;
            if (this.pendingGhost !== this.isGhost) {
                if (this.pendingGhost) {
                    this.isGhost = true;
                    this.ascending = true;
                    this.ascensionStartTime = Date.now();
                    this.ascensionStartY = this.y;
                    this.ascensionTargetY = this.groundY - 40;
                    state.ghostParticles.length = 0;
                } else {
                    this.isGhost = false;
                    this.y = this.groundY;
                }
                this.pendingGhost = this.isGhost;
            }
        }
    }

    hurt() {
        this.hitEffectTimer = 14;
        this.lastDamageTime = Date.now();
        for (let i = 0; i < 8; i++) {
            state.bloodParticles.push(new BloodParticle(this.x, this.y - 30, '#ff0000'));
        }
    }

    nudge(direction) {
        const nudgeAmount = 50;
        this.nudgeTargetX = this.x + (direction === 'left' ? -nudgeAmount : nudgeAmount);
        this.nudgeTargetX = Math.max(50, Math.min(canvas.width - 50, this.nudgeTargetX));
        this.nudgeExpiresAt = Date.now() + 5000;
    }

    wrapX(x) {
        if (x < -100) return canvas.width + 100;
        if (x > canvas.width + 100) return -100;
        return x;
    }

    wrappedDiff(target, current) {
        let diff = target - current;
        if (diff > canvas.width / 2) diff -= canvas.width;
        if (diff < -canvas.width / 2) diff += canvas.width;
        return diff;
    }

    setBuffGlow(active) {
        this.buffGlow = active;
        if (active) this.buffGlowTimer = 60;
        else this.buffGlowTimer = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const isGhost = this.isGhost;
        const isEnhanced = this.isEnhanced;
        const facingRight = this.facingRight;
        const hitFlash = this.hitEffectTimer > 0 && Math.floor(this.hitEffectTimer / 3) % 2 === 0;

        if (isGhost) {
            this.drawGhost(ctx, facingRight, hitFlash);
        } else {
            this.drawAlive(ctx, facingRight, hitFlash, isEnhanced);
        }

        ctx.restore();
    }

    drawGhost(ctx, facingRight, hitFlash) {
        const halfSize = 20;
        
        if (this.ascending) {
            for (let i = 0; i < 6; i++) {
                state.ghostParticles.push(new GhostParticle(this.x, this.y, halfSize));
            }
        }

        const headSize = 28;
        const bodyWidth = 24;
        const bodyHeight = 28;
        
        ctx.strokeStyle = hitFlash ? '#ffffff' : 'rgba(100, 150, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.fillStyle = hitFlash ? 'rgba(255, 255, 255, 0.95)' : 'rgba(180, 210, 255, 0.35)';

        const headY = -bodyHeight - headSize;
        ctx.fillRect(-headSize / 2, headY, headSize, headSize);
        ctx.strokeRect(-headSize / 2, headY, headSize, headSize);

        ctx.fillStyle = '#000000';
        const eyeSize = 4;
        const dir = facingRight ? 1 : -1;
        ctx.fillRect(dir * 6 - eyeSize / 2, headY + 8, eyeSize, eyeSize);
        ctx.fillRect(dir * 2 - eyeSize / 2, headY + 8, eyeSize, eyeSize);
        ctx.fillRect(-2, headY + 16, 4, 2);

        ctx.fillStyle = hitFlash ? 'rgba(255, 255, 255, 0.95)' : 'rgba(180, 210, 255, 0.35)';
        ctx.fillRect(-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight);
        ctx.strokeRect(-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight);

        ctx.strokeStyle = hitFlash ? '#ffffff' : 'rgba(100, 150, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-bodyWidth / 2, -bodyHeight + 8);
        ctx.lineTo(-bodyWidth / 2 - 14, -bodyHeight + 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bodyWidth / 2, -bodyHeight + 8);
        ctx.lineTo(bodyWidth / 2 + 14, -bodyHeight + 20);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-bodyWidth / 2, -bodyHeight + bodyHeight);
        ctx.lineTo(-bodyWidth / 2 - 10, -bodyHeight + bodyHeight + 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bodyWidth / 2, -bodyHeight + bodyHeight);
        ctx.lineTo(bodyWidth / 2 + 10, -bodyHeight + bodyHeight + 18);
        ctx.stroke();

        if (this.ascending) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            for (let i = 0; i < 3; i++) {
                const yOffset = -bodyHeight - headSize - 10 - i * 8;
                ctx.beginPath();
                ctx.arc(0, yOffset, 6 + i * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawAlive(ctx, facingRight, hitFlash, isEnhanced) {
        const avatar = getAvatarImage(this.mcUser);
        const boxSize = 40;
        const halfBox = boxSize / 2;

        if (avatar && avatar.complete && avatar.naturalWidth > 0) {
            if (hitFlash) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 50, 50, 0.6)';
                ctx.fillRect(-halfBox, -boxSize, boxSize, boxSize);
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.drawImage(avatar, -halfBox, -boxSize, boxSize, boxSize);

            if (isEnhanced) {
                ctx.save();
                const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
                ctx.globalAlpha = pulse * 0.6;
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, -boxSize / 2, halfBox + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            if (this.buffGlow) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, -boxSize / 2, halfBox + 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        } else {
            ctx.fillStyle = hitFlash ? '#ff5555' : (facingRight ? '#4CAF50' : '#2196F3');
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.fillRect(-halfBox, -boxSize, boxSize, boxSize);
            ctx.strokeRect(-halfBox, -boxSize, boxSize, boxSize);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.username.slice(0, 4).toUpperCase(), 0, -halfBox + 4);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.strokeText(this.username, 0, boxSize + 16);
        ctx.fillText(this.username, 0, boxSize + 16);
        
        if (this.isEnhanced) {
            ctx.fillStyle = '#ffd700';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.font = 'bold 14px monospace';
            ctx.strokeText('★ ENHANCED ★', 0, boxSize + 32);
            ctx.fillText('★ ENHANCED ★', 0, boxSize + 32);
        }
    }
}