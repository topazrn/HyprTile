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

    const gappedNewGeometry = addGaps(newGeometry, workArea, gapsIn, gapsOut);

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

    const actorMargin = { 
        width: actor.width - gappedOldGeometry.width, 
        height: actor.height - gappedOldGeometry.height 
    };
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

// Assuming geometry not gapped
export function addGaps(geometry: IGeometry, workArea: IGeometry, gapsIn: number, gapsOut: number) {
    const leftIsOut = geometry.x === workArea.x;
    const topIsOut = geometry.y === workArea.y;
    const rightIsOut = geometry.x + geometry.width === workArea.x + workArea.width;
    const bottomIsOut = geometry.y + geometry.height === workArea.y + workArea.height;

    const gap = {
        x: leftIsOut ? gapsOut : gapsIn,
        y: topIsOut ? gapsOut : gapsIn,
        width: rightIsOut ? gapsOut : gapsIn,
        height: bottomIsOut ? gapsOut : gapsIn,
    };

    return {
        x: geometry.x + gap.x,
        y: geometry.y + gap.y,
        width: geometry.width - gap.x - gap.width,
        height: geometry.height - gap.y - gap.height
    }
}

// Assuming geometry has gaps
export function removeGaps(geometry: IGeometry, workArea: IGeometry, gapsIn: number, gapsOut: number) {
    const leftIsOut = geometry.x - gapsOut == workArea.x;
    const topIsOut = geometry.y - gapsOut == workArea.y;
    const rightIsOut = geometry.x + geometry.width + gapsOut === workArea.x + workArea.width;
    const bottomIsOut = geometry.y + geometry.height === workArea.y + workArea.height;

    const gap = {
        x: leftIsOut ? gapsOut : gapsIn,
        y: topIsOut ? gapsOut : gapsIn,
        width: rightIsOut ? gapsOut : gapsIn,
        height: bottomIsOut ? gapsOut : gapsIn,
    };

    return {
        x: geometry.x - gap.x,
        y: geometry.y - gap.y,
        width: geometry.width + gap.x + gap.width,
        height: geometry.height + gap.y + gap.height
    }
}