export class GhostParticle {
    constructor(x, y, halfSize) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.x = x + side * (halfSize + Math.random() * 12);
        this.y = y + (Math.random() - 0.5) * halfSize * 1.5;
        this.vx = side * (Math.random() * 0.3 + 0.1);
        this.vy = -Math.random() * 0.6 - 0.2;
        this.life = 1.0;
        this.size = Math.random() * 8 + 6;
        this.squish = Math.random() * 0.6 + 0.4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.985;
        this.vy -= 0.006;
        this.life -= 0.008;
        this.rotation += this.rotationSpeed;
        this.size += 0.15;
        return this.life > 0;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.life * 0.25;
        
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grad.addColorStop(0, 'rgba(160, 175, 190, 0.4)');
        grad.addColorStop(0.4, 'rgba(140, 160, 180, 0.2)');
        grad.addColorStop(1, 'rgba(120, 140, 160, 0)');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * this.squish, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }
}