import type Gio from "gi://Gio";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import { LayoutManager } from "./layout/manager.js";
import type { IPoint } from "./util/geometry.js";
import { GarbageCollector } from "./util/gc.js";

export default class HyprTile extends GarbageCollector {
  private readonly shell = Shell.Global.get();
  private readonly display = this.shell.display;
  private readonly settings: Gio.Settings;
  private readonly layoutManager: LayoutManager;

  constructor(settings: Gio.Settings) {
    super();
    this.settings = settings;
    this.layoutManager = new LayoutManager(this.settings);
  }

  start() {
    const windowEntered = this.display.connect_after(
      "window-created",
      (_display, windowMightNotShown) => {
        const [pointerX, pointerY] = this.shell.get_pointer();
        const point: IPoint = { x: pointerX, y: pointerY };

        const windowChangedWorkspace = windowMightNotShown.connect_after(
          "workspace-changed",
          (window) => {
            // This event also fires when the window is closed
            if (!windowMightNotShown || !windowMightNotShown.get_workspace())
              return;
            this.layoutManager.pop(window);
            this.layoutManager.push(window);
          },
        );
        this.defer(() =>
          windowMightNotShown.disconnect(windowChangedWorkspace),
        );

        const windowClosed = windowMightNotShown.connect_after(
          "unmanaged",
          () => {
            windowMightNotShown.disconnect(windowChangedWorkspace);
            windowMightNotShown.disconnect(windowClosed);
          },
        );
        this.defer(() => windowMightNotShown.disconnect(windowClosed));

        const actor: Meta.WindowActor =
          windowMightNotShown.get_compositor_private();
        const effectsCompleted = actor.connect_after(
          "effects-completed",
          () => {
            actor.disconnect(effectsCompleted);
            this.layoutManager.push(windowMightNotShown, point);
          },
        );
      },
    );
    this.defer(() => this.display.disconnect(windowEntered));

    const windowLeft = this.display.connect_after(
      "window-left-monitor",
      (_display, _, window) => {
        this.layoutManager.pop(window);
      },
    );
    this.defer(() => this.display.disconnect(windowLeft));

    const windowGrabbed = this.display.connect_after(
      "grab-op-begin",
      (_display, window, operation) => {
        if (
          operation === Meta.GrabOp.MOVING ||
          operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
          operation === Meta.GrabOp.KEYBOARD_MOVING
        ) {
          this.layoutManager.pop(window);
        }
      },
    );
    this.defer(() => this.display.disconnect(windowGrabbed));

    const windowReleased = this.display.connect_after(
      "grab-op-end",
      (_display, window, operation) => {
        if (
          operation === Meta.GrabOp.MOVING ||
          operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
          operation === Meta.GrabOp.KEYBOARD_MOVING
        ) {
          this.layoutManager.push(window);
        }

        if (
          operation === Meta.GrabOp.RESIZING_NW ||
          operation === Meta.GrabOp.RESIZING_N ||
          operation === Meta.GrabOp.RESIZING_NE ||
          operation === Meta.GrabOp.RESIZING_E ||
          operation === Meta.GrabOp.RESIZING_SW ||
          operation === Meta.GrabOp.RESIZING_S ||
          operation === Meta.GrabOp.RESIZING_SE ||
          operation === Meta.GrabOp.RESIZING_W ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_NW ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_N ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_NE ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_E ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_SW ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_S ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_SE ||
          operation === Meta.GrabOp.KEYBOARD_RESIZING_W
        ) {
          this.layoutManager.resizeNeighbors(window);

          const sizeChanged = window.connect_after("size-changed", () => {
            // Only triggers if the user does the resize operation quickly
            window.disconnect(sizeChanged);
            this.layoutManager.resizeNeighbors(window);
          });

          setTimeout(() => {
            // In case the user does the resize operation carefully
            window.disconnect(sizeChanged);
          }, 100);
        }
      },
    );
    this.defer(() => this.display.disconnect(windowReleased));

    const settingsChanged = this.settings.connect("changed", (_, key) => {
      console.debug(`Settings changed: ${key}`);
      if (key === "gaps-in" || key === "gaps-out") {
        this.layoutManager.resizeAll();
        return;
      }

      if (key === "layout") {
        this.layoutManager.reinitializeLayouts();
        return;
      }
    });
    this.defer(() => this.settings.disconnect(settingsChanged));

    const workareaChanged = this.display.connect_after(
      "workareas-changed",
      (_) => {
        this.layoutManager.updateWorkArea();
        this.layoutManager.resizeAll();
      },
    );
    this.defer(() => this.display.disconnect(workareaChanged));

    this.display.list_all_windows().forEach((window) => {
      this.layoutManager.push(window);
    });
  }
}
