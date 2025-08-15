import Meta from "gi://Meta";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import { IGeometry } from "./bsp.js";
import { EasingParamsWithProperties } from "@girs/gnome-shell/extensions/global";
import { easeActor } from "./easer.js";

export function resizeWindow(windowHandle: Meta.Window, newGeometry: IGeometry, workArea: IGeometry, settings: Gio.Settings): void {
    const animate = settings.get_boolean("animate");
    const gapsIn = settings.get_int("gaps-in")
    const gapsOut = settings.get_int("gaps-out")

    console.debug(`Resize window called on ${windowHandle.title} (${windowHandle.get_pid()})`)

    const gappedNewGeometry = addGaps(newGeometry, workArea, gapsIn, gapsOut);
    const gappedOldGeometry: IGeometry = windowHandle.get_frame_rect();
    const actor: Meta.WindowActor | null = windowHandle.get_compositor_private();

    if (!animate || !actor) {
        simpleResizeWindow(windowHandle, gappedNewGeometry);
        return;
    }

    const actorMargin = {
        width: actor.width - gappedOldGeometry.width,
        height: actor.height - gappedOldGeometry.height
    };

    const scaleX = gappedNewGeometry.width / gappedOldGeometry.width;
    const scaleY = gappedNewGeometry.height / gappedOldGeometry.height;
    const translationX = (gappedNewGeometry.x - gappedOldGeometry.x) + (1 - scaleX) * actorMargin.width;
    const translationY = (gappedNewGeometry.y - gappedOldGeometry.y) + (1 - scaleY) * actorMargin.height;

    const easeParams: EasingParamsWithProperties = {
        scaleX, scaleY, translationX, translationY,
        mode: Clutter.AnimationMode.EASE_IN_OUT_EXPO,
        duration: 700,
        onStopped: (finished) => {
            if (!finished) {
                console.debug(`Animation Stopped Abruptly`);
            }
        },
        onComplete: () => {
            console.debug("Animation Completed");
            simpleResizeWindow(windowHandle, gappedNewGeometry, () => {
                actor.set_scale(1, 1);
                actor.set_translation(0, 0, 0);
            });
        }
    };

    console.debug("Animation Started");
    easeActor(actor, easeParams);
}

export function simpleResizeWindow(windowHandle: Meta.Window, newGeometry: IGeometry, callback?: () => void) {
    if (!windowHandle || !windowHandle.get_workspace()) return;
    if (windowHandle.fullscreen) {
        windowHandle.unmake_fullscreen();
    } else if (windowHandle.maximizedHorizontally && windowHandle.maximizedVertically) {
        windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
    } else if (windowHandle.maximizedHorizontally) {
        windowHandle.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
    } else if (windowHandle.maximizedVertically) {
        windowHandle.unmaximize(Meta.MaximizeFlags.VERTICAL);
    }

    const geometry = windowHandle.get_frame_rect();

    if (geometry.width !== newGeometry.width || geometry.height !== newGeometry.height) {
        const onComplete = windowHandle.connect_after("size-changed", () => {
            windowHandle.disconnect(onComplete);
            callback!();
        });

        windowHandle.move_resize_frame(
            true,
            newGeometry.x,
            newGeometry.y,
            newGeometry.width,
            newGeometry.height
        );
        return;
    }

    if (geometry.x !== newGeometry.x || geometry.y !== newGeometry.y) {
        const onComplete = windowHandle.connect_after("position-changed", () => {
            windowHandle.disconnect(onComplete);
            callback!();
        });

        windowHandle.move_frame(
            true,
            newGeometry.x,
            newGeometry.y
        )
        return;
    }

    callback!();
}

// Assuming geometry not gapped
export function addGaps(geometry: IGeometry, workArea: IGeometry, gapsIn: number, gapsOut: number) {
    const leftIsOut = geometry.x === workArea.x;
    const topIsOut = geometry.y === workArea.y;
    const rightIsOut = geometry.x + geometry.width === workArea.x + workArea.width;
    const bottomIsOut = geometry.y + geometry.height === workArea.y + workArea.height;

    const gap = {
        left: leftIsOut ? gapsOut : gapsIn,
        top: topIsOut ? gapsOut : gapsIn,
        right: rightIsOut ? gapsOut : gapsIn,
        bottom: bottomIsOut ? gapsOut : gapsIn,
    };

    return {
        x: geometry.x + gap.left,
        y: geometry.y + gap.top,
        width: geometry.width - gap.left - gap.right,
        height: geometry.height - gap.top - gap.bottom
    }
}

// Assuming geometry has gaps
export function removeGaps(geometry: IGeometry, workArea: IGeometry, gapsIn: number, gapsOut: number) {
    const leftIsOut = geometry.x - gapsOut == workArea.x;
    const topIsOut = geometry.y - gapsOut == workArea.y;
    const rightIsOut = geometry.x + geometry.width + gapsOut === workArea.x + workArea.width;
    const bottomIsOut = geometry.y + geometry.height === workArea.y + workArea.height;

    const gap = {
        left: leftIsOut ? gapsOut : gapsIn,
        top: topIsOut ? gapsOut : gapsIn,
        right: rightIsOut ? gapsOut : gapsIn,
        bottom: bottomIsOut ? gapsOut : gapsIn,
    };

    return {
        x: geometry.x - gap.left,
        y: geometry.y - gap.top,
        width: geometry.width + gap.left + gap.right,
        height: geometry.height + gap.top + gap.bottom,
    }
}

export function windowFilter(window: Meta.Window): boolean {
    if (window.windowType !== Meta.WindowType.NORMAL) {
        console.debug(`Window Filter: window ${window.title} type is ${window.windowType}.`);
        return false;
    }
    if (window.get_transient_for()) {
        console.debug(`Window Filter: window ${window.title} is transient.`);
        return false;
    }
    if (window.onAllWorkspaces) {
        console.debug(`Window Filter: window ${window.title} is on all workspaces.`);
        return false;
    }
    if (!window.resizeable) {
        console.debug(`Window Filter: window ${window.title} is not resizable.`);
        return false;
    }

    return true;
}

export function keyOf(window: Meta.Window): string {
    return `${window.get_workspace()}-${window.get_monitor()}`;
}