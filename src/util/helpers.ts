import { EasingParamsWithProperties } from "@girs/gnome-shell/extensions/global";
import Meta from "gi://Meta";
import Clutter from "gi://Clutter";

/**
 * Represents the geometric properties of a window or a screen region.
 */
export interface IGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Determines if a given point (cursorX, cursorY) is within the bounds of a geometry.
 */
export function isPointInGeometry(x: number, y: number, geometry: IGeometry): boolean {
    return x >= geometry.x && x < (geometry.x + geometry.width) &&
        y >= geometry.y && y < (geometry.y + geometry.height);
}

export function resizeWindow(windowHandle: Meta.Window, newGeometry: IGeometry, animate: boolean): void {
    if (!animate) {
        windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
        windowHandle.move_resize_frame(true, newGeometry.x, newGeometry.y, newGeometry.width, newGeometry.height);
        return;
    }

    const oldGeometry: IGeometry = windowHandle.get_frame_rect();
    if (
        oldGeometry.x === newGeometry.x &&
        oldGeometry.y === newGeometry.y &&
        oldGeometry.width === newGeometry.width &&
        oldGeometry.height === newGeometry.height
    ) return;

    const actor: Meta.WindowActor | null = windowHandle.get_compositor_private();
    if (!actor) {
        console.warn("Warning: Window actor is null, cannot animate resize. Performing instant resize.");
        windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
        windowHandle.move_resize_frame(true, newGeometry.x, newGeometry.y, newGeometry.width, newGeometry.height);
        return;
    }

    const actorMargin = { width: actor.width - oldGeometry.width, height: actor.height - oldGeometry.height }
    const duration = 700;

    windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
    windowHandle.move_resize_frame(true, newGeometry.x, newGeometry.y, newGeometry.width, newGeometry.height);

    actor.scaleX = oldGeometry.width / newGeometry.width;
    actor.scaleY = oldGeometry.height / newGeometry.height;
    actor.translationX = (oldGeometry.x - newGeometry.x) + (1 - actor.scaleX) * actorMargin.width;
    actor.translationY = (oldGeometry.y - newGeometry.y) + (1 - actor.scaleY) * actorMargin.height;

    const easeParams: EasingParamsWithProperties = {
        translationX: 0,
        translationY: 0,
        scaleX: 1,
        scaleY: 1,
        mode: Clutter.AnimationMode.EASE_IN_OUT_EXPO,
        duration: duration,
    };

    (actor as any).ease(easeParams);
}