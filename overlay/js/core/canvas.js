export const canvas = document.getElementById('overlayCanvas');
export const ctx = canvas.getContext('2d');

export function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();