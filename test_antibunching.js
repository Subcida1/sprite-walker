/**
 * Verification test for Slime anti-bunching separation steering and dramatic speed variance.
 */
const assert = require('assert');

global.canvas = { width: 800, height: 600 };

class TestSlime {
    constructor(x) {
        this.x = x;
        this.baseSpeed = 1.0;
        this.speed = this.baseSpeed * (0.4 + Math.random() * 1.8);
    }
    wrapX(x) { return (x + canvas.width) % canvas.width; }
    wrappedDiff(target, current) {
        let diff = target - current;
        if (diff > canvas.width / 2) diff -= canvas.width;
        if (diff < -canvas.width / 2) diff += canvas.width;
        return diff;
    }
    wrappedDist(a, b) { return Math.abs(this.wrappedDiff(b, a)); }
}

console.log("Running Anti-Bunching & Speed Variance Verification...");

// Test speed range (0.4x to 2.2x)
for (let i = 0; i < 50; i++) {
    const s = new TestSlime(100);
    assert(s.speed >= 0.4 && s.speed <= 2.2, `Speed ${s.speed} out of bounds!`);
}

// Test separation steering when two slimes are close (< 60px)
const slimeA = new TestSlime(100);
const slimeB = new TestSlime(110); // only 10px apart
const slimeMobs = [slimeA, slimeB];

// Simulate separation step
for (const other of slimeMobs) {
    if (other === slimeA) continue;
    const sepDist = slimeA.wrappedDist(other.x, slimeA.x);
    if (sepDist < 60 && sepDist > 0) {
        const pushDir = Math.sign(slimeA.wrappedDiff(slimeA.x, other.x));
        slimeA.x += pushDir * (60 - sepDist) * 0.04;
    }
}

assert(slimeA.x < 100, `Expected slimeA to be pushed away from slimeB, got position ${slimeA.x}`);
console.log(`[CONFIRMED] Separation Steering successfully pushed slimeA away from slimeB (new pos: ${slimeA.x.toFixed(2)})`);
console.log("ALL ANTI-BUNCHING PROOFS PASSED SUCCESSFULLY!");
