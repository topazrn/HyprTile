import Clutter from "gi://Clutter";
import type Gio from "gi://Gio";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import type { EasingParamsWithProperties } from "@girs/gnome-shell/extensions/global";
import type { IGeometry } from "./bsp.js";
import { easeActor } from "./easer.js";

export async function resizeWindow(
  windowHandle: Meta.Window,
  newGeometry: IGeometry,
  workArea: IGeometry,
  settings: Gio.Settings,
): Promise<void> {
  const animate = settings.get_boolean("animate");
  const gapsIn = settings.get_int("gaps-in");
  const gapsOut = settings.get_int("gaps-out");

  console.debug(
    `Resize window called on ${windowHandle.title} (${windowHandle.get_pid()})`,
  );

  const gappedNewGeometry = addGaps(newGeometry, workArea, gapsIn, gapsOut);
  const gappedOldGeometry: IGeometry = windowHandle.get_frame_rect();
  const actor: Meta.WindowActor | null = windowHandle.get_compositor_private();

  if (!animate || !actor) {
    simpleResizeWindow(windowHandle, gappedNewGeometry);
    return;
  }

  const actorMargin = {
    width: actor.width - gappedOldGeometry.width,
    height: actor.height - gappedOldGeometry.height,
  };

  const scaleX = gappedNewGeometry.width / gappedOldGeometry.width;
  const scaleY = gappedNewGeometry.height / gappedOldGeometry.height;
  const translationX =
    gappedNewGeometry.x -
    gappedOldGeometry.x +
    (1 - scaleX) * actorMargin.width;
  const translationY =
    gappedNewGeometry.y -
    gappedOldGeometry.y +
    (1 - scaleY) * actorMargin.height;

  const easeParams: EasingParamsWithProperties = {
    scaleX,
    scaleY,
    translationX,
    translationY,
    mode: Clutter.AnimationMode.EASE_IN_OUT_EXPO,
    duration: 700,
  };

  try {
    console.debug("Animation Started");
    await easeActor(actor, easeParams);
    console.debug("Animation Completed");
    await simpleResizeWindow(windowHandle, gappedNewGeometry);
    actor.set_scale(1, 1);
    actor.set_translation(0, 0, 0);
  } catch {
    console.debug(`Animation Stopped Abruptly`);
  }
}

export async function simpleResizeWindow(
  windowHandle: Meta.Window,
  newGeometry: IGeometry,
): Promise<void> {
  if (!windowHandle || !windowHandle.get_workspace()) return;
  if (windowHandle.fullscreen) {
    windowHandle.unmake_fullscreen();
  } else if (
    windowHandle.maximizedHorizontally &&
    windowHandle.maximizedVertically
  ) {
    windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
  } else if (windowHandle.maximizedHorizontally) {
    windowHandle.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
  } else if (windowHandle.maximizedVertically) {
    windowHandle.unmaximize(Meta.MaximizeFlags.VERTICAL);
  }

  const geometry = windowHandle.get_frame_rect();

  if (
    geometry.width !== newGeometry.width ||
    geometry.height !== newGeometry.height
  ) {
    const promise = new Promise<void>((resolve) => {
      const onComplete = windowHandle.connect_after("size-changed", () => {
        windowHandle.disconnect(onComplete);
        resolve();
      });
    });

    windowHandle.move_resize_frame(
      true,
      newGeometry.x,
      newGeometry.y,
      newGeometry.width,
      newGeometry.height,
    );
    return promise;
  }

  if (geometry.x !== newGeometry.x || geometry.y !== newGeometry.y) {
    const promise = new Promise<void>((resolve) => {
      const onComplete = windowHandle.connect_after("position-changed", () => {
        windowHandle.disconnect(onComplete);
        resolve();
      });
    });

    windowHandle.move_frame(true, newGeometry.x, newGeometry.y);
    return promise;
  }
}

// Assuming geometry not gapped
export function addGaps(
  geometry: IGeometry,
  workArea: IGeometry,
  gapsIn: number,
  gapsOut: number,
) {
  const leftIsOut = geometry.x === workArea.x;
  const topIsOut = geometry.y === workArea.y;
  const rightIsOut =
    geometry.x + geometry.width === workArea.x + workArea.width;
  const bottomIsOut =
    geometry.y + geometry.height === workArea.y + workArea.height;

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
    height: geometry.height - gap.top - gap.bottom,
  };
}

// Assuming geometry has gaps
export function removeGaps(
  geometry: IGeometry,
  workArea: IGeometry,
  gapsIn: number,
  gapsOut: number,
) {
  const leftIsOut = geometry.x - gapsOut === workArea.x;
  const topIsOut = geometry.y - gapsOut === workArea.y;
  const rightIsOut =
    geometry.x + geometry.width + gapsOut === workArea.x + workArea.width;
  const bottomIsOut =
    geometry.y + geometry.height === workArea.y + workArea.height;

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
  };
}

export function windowFilter(window: Meta.Window): boolean {
  if (window.windowType !== Meta.WindowType.NORMAL) {
    console.debug(
      `Window Filter: window ${window.title} type is ${window.windowType}.`,
    );
    return false;
  }
  if (window.get_transient_for()) {
    console.debug(`Window Filter: window ${window.title} is transient.`);
    return false;
  }
  if (window.onAllWorkspaces) {
    console.debug(
      `Window Filter: window ${window.title} is on all workspaces.`,
    );
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

export function getWorkArea(workspaceId: number, monitorId: number): IGeometry {
  const display = Shell.Global.get().display;
  const workspaceManager = display.get_workspace_manager();
  const workspace = workspaceManager.get_workspace_by_index(workspaceId);
  if (!workspace) {
    console.warn(`No workspace found for index ${workspaceId}`);
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return workspace.get_work_area_for_monitor(monitorId);
}
