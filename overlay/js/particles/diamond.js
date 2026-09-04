export class MinecraftDiamondDrop {
    constructor(x, canvasWidth, canvasHeight) {
        this.targetX = x;
        this.x = x;
        this.y = -30;
        this.groundY = canvasHeight - 50;
        this.spawnTime = Date.now();
        this.claimed = false;
        this.claimTime = 0;
        this.life = 1.0;
    }
    update(canvasHeight) {
        this.groundY = canvasHeight - 50;
        if (this.claimed) {
            this.life = Math.max(0, (this.claimTime + 500 - Date.now()) / 500);
            return this.life > 0;
        }
        const elapsed = Date.now() - this.spawnTime;
        const fallDuration = 1000;
        const progress = Math.min(1, elapsed / fallDuration);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.y = -30 + eased * (this.groundY - (-30));
        
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

        ctx.fillStyle = '#00ffff';
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

        ctx.fillStyle = '#80ffff';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(6, -3);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, -3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -8, 3, 3);

        ctx.restore();
    }
}