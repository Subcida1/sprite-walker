export const skinCache = {};

export function getAvatarImage(mcUser) {
    const key = mcUser ? mcUser.toLowerCase() : 'steve';
    if (!skinCache[key]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // Add cache buster query parameter to prevent stale browser caching
        img.src = `/api/avatar/${encodeURIComponent(key)}?v=2`;
        img.onerror = () => {
            console.warn(`[Avatar] Failed to load skin for ${key}, using procedural fallback`);
        };
        skinCache[key] = img;
    }
    return skinCache[key];
}