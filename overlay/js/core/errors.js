export function safeUpdate(fn, name) {
    try {
        fn();
    } catch (err) {
        console.error(`[Error Boundary] Failed to update ${name}:`, err);
    }
}

export function safeDraw(fn, name) {
    try {
        fn();
    } catch (err) {
        console.error(`[Error Boundary] Failed to draw ${name}:`, err);
    }
}

export function safeCall(fn, name) {
    try {
        return fn();
    } catch (err) {
        console.error(`[Error Boundary] Failed in ${name}:`, err);
    }
}
