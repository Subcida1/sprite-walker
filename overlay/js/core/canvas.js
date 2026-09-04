export const canvas = document.getElementById('overlayCanvas');
export const ctx = canvas.getContext('2d');

export function resize() {
    canvas.width = window.innerWidth || 1920;
    canvas.height = window.innerHeight || 1080;
}

window.addEventListener('resize', resize);
resize();
