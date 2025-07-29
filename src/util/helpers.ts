import { EasingParamsWithProperties } from "@girs/gnome-shell/extensions/global";
import Meta from "gi://Meta";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";

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

export function resizeWindow(windowHandle: Meta.Window, newGeometry: IGeometry, workArea: IGeometry, settings: Gio.Settings): void {
    const animate = settings.get_boolean("animate");
    const gapsIn = settings.get_int("gaps-in")
    const gapsOut = settings.get_int("gaps-out")

    const gap = {
        x: newGeometry.x === workArea.x ? gapsOut : gapsIn,
        y: newGeometry.y === workArea.y ? gapsOut : gapsIn,
        width: newGeometry.x + newGeometry.width === workArea.x + workArea.width ? gapsOut : gapsIn,
        height: newGeometry.y + newGeometry.height === workArea.y + workArea.height ? gapsOut : gapsIn,
    };

    const gappedNewGeometry = {
        x: newGeometry.x + gap.x,
        y: newGeometry.y + gap.y,
        width: newGeometry.width - gap.x - gap.width,
        height: newGeometry.height - gap.y - gap.height
    }

    const actor: Meta.WindowActor | null = windowHandle.get_compositor_private();

    if (!animate || !actor) {
        windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
        windowHandle.move_resize_frame(
            true,
            gappedNewGeometry.x,
            gappedNewGeometry.y,
            gappedNewGeometry.width,
            gappedNewGeometry.height
        );
        return;
    }

    const gappedOldGeometry: IGeometry = windowHandle.get_frame_rect();
    if (
        gappedOldGeometry.x === gappedNewGeometry.x &&
        gappedOldGeometry.y === gappedNewGeometry.y &&
        gappedOldGeometry.width === gappedNewGeometry.width &&
        gappedOldGeometry.height === gappedNewGeometry.height
    ) return;

    const actorMargin = { width: actor.width - gappedOldGeometry.width, height: actor.height - gappedOldGeometry.height }
    const duration = 700;

    windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
    windowHandle.move_resize_frame(
        true,
        gappedNewGeometry.x,
        gappedNewGeometry.y,
        gappedNewGeometry.width,
        gappedNewGeometry.height
    );

    actor.scaleX = gappedOldGeometry.width / gappedNewGeometry.width;
    actor.scaleY = gappedOldGeometry.height / gappedNewGeometry.height;
    actor.translationX = (gappedOldGeometry.x - gappedNewGeometry.x) + (1 - actor.scaleX) * actorMargin.width;
    actor.translationY = (gappedOldGeometry.y - gappedNewGeometry.y) + (1 - actor.scaleY) * actorMargin.height;

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