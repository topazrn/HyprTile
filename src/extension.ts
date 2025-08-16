import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import { LayoutManager } from './layout/manager.js';
import { IPoint } from './util/bsp.js';

export default class MyExtension extends Extension {
  private readonly connections: Function[] = [];
  private readonly shell = Shell.Global.get();
  private readonly display = this.shell.display;
  private readonly settings = this.getSettings();

  constructor(metadata: ExtensionMetadata) {
    super(metadata);
  }

  enable() {
    const layoutManager = new LayoutManager(this.settings);

    const windowEntered = this.display.connect_after("window-created", (_display, windowMightNotShown) => {
      const [pointerX, pointerY] = this.shell.get_pointer();
      const point: IPoint = { x: pointerX, y: pointerY };

      const windowChangedWorkspace = windowMightNotShown.connect_after("workspace-changed", (window) => {
        // This event also fires when the window is closed
        if (!windowMightNotShown || !windowMightNotShown.get_workspace()) return;
        layoutManager.pop(window);
        layoutManager.push(window);
      });
      this.connections.push(() => windowMightNotShown.disconnect(windowChangedWorkspace));

      const windowClosed = windowMightNotShown.connect_after("unmanaged", () => {
        windowMightNotShown.disconnect(windowChangedWorkspace);
        windowMightNotShown.disconnect(windowClosed);
      });
      this.connections.push(() => windowMightNotShown.disconnect(windowClosed));

      const actor: Meta.WindowActor = windowMightNotShown.get_compositor_private();
      const effectsCompleted = actor.connect_after("effects-completed", () => {
        actor.disconnect(effectsCompleted);
        layoutManager.push(windowMightNotShown, point);
      });
    });
    this.connections.push(() => this.display.disconnect(windowEntered));

    const windowLeft = this.display.connect_after("window-left-monitor", (_display, _, window) => {
      layoutManager.pop(window);
    });
    this.connections.push(() => this.display.disconnect(windowLeft));

    const windowGrabbed = this.display.connect_after("grab-op-begin", (_display, window, operation) => {
      if (
        operation === Meta.GrabOp.MOVING ||
        operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
        operation === Meta.GrabOp.KEYBOARD_MOVING
      ) {
        layoutManager.pop(window);
      }
    });
    this.connections.push(() => this.display.disconnect(windowGrabbed));

    const windowReleased = this.display.connect_after("grab-op-end", (_display, window, operation) => {
      if (
        operation === Meta.GrabOp.MOVING ||
        operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
        operation === Meta.GrabOp.KEYBOARD_MOVING
      ) {
        layoutManager.push(window);
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
        const sizeChanged = window.connect_after("size-changed", () => {
          window.disconnect(sizeChanged);
          layoutManager.resizeNeighbors(window);
        });
      }
    });
    this.connections.push(() => this.display.disconnect(windowReleased));

    const settingsChanged = this.settings.connect("changed", (_, key) => {
      console.debug(`Settings changed: ${key}`);
      if (key === "gaps-in" || key === "gaps-out") {
        layoutManager.resizeAll();
        return;
      }

      if (key === "layout") {
        layoutManager.reinitializeLayouts();
        return;
      }
    });
    this.connections.push(() => this.settings.disconnect(settingsChanged))

    this.display.list_all_windows().forEach((window) => {
      layoutManager.push(window);
    });
  }

  disable() {
    while (this.connections.length > 0) {
      this.connections.pop()!();
    }
  }
}