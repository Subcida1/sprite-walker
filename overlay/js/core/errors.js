export function safeUpdate(entity, name) {
    try {
        entity.update();
    } catch (err) {
        console.error(`[Error Boundary] Failed to update ${name}:`, err);
    }
}

export function safeDraw(entity, ctx, name) {
    try {
        entity.draw(ctx);
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