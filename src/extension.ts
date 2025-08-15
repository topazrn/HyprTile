import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import Dwindle from './layout/dwindle.js';
import { IPoint } from './util/bsp.js';

export default class MyExtension extends Extension {
  private connections: Function[] = [];
  private shell = Shell.Global.get();
  private display = this.shell.display;

  constructor(metadata: ExtensionMetadata) {
    super(metadata);
  }

  enable() {
    const windowEntered = this.display.connect_after("window-entered-monitor", (_display, _, windowMightNotShown) => {
      const [pointerX, pointerY] = this.shell.get_pointer();
      const point: IPoint = { x: pointerX, y: pointerY };

      const windowChangedWorkspace = windowMightNotShown.connect_after("workspace-changed", (window) => {
        // This event also fires when the window is closed
        if (!windowMightNotShown || !windowMightNotShown.get_workspace()) return;
        Dwindle.pop(window);
        Dwindle.push(window);
      });
      this.connections.push(() => windowMightNotShown.disconnect(windowChangedWorkspace));

      const windowClosed = windowMightNotShown.connect_after("unmanaged", () => {
        windowMightNotShown.disconnect(windowChangedWorkspace);
        windowMightNotShown.disconnect(windowClosed);
      });
      this.connections.push(() => windowMightNotShown.disconnect(windowClosed));

      if (windowMightNotShown.title) {
        Dwindle.push(windowMightNotShown, point);
        return;
      }

      const windowShown = windowMightNotShown.connect_after("shown", (window) => {
        windowMightNotShown.disconnect(windowShown);
        const actor: Meta.WindowActor = window.get_compositor_private();

        const effectsCompleted = actor.connect_after("effects-completed", (_) => {
          actor.disconnect(effectsCompleted);
          Dwindle.push(window, point);
        })
        this.connections.push(() => actor.disconnect(effectsCompleted));
      }
      );
      this.connections.push(() => windowMightNotShown.disconnect(windowShown));
    });
    this.connections.push(() => this.display.disconnect(windowEntered));

    const windowLeft = this.display.connect_after("window-left-monitor", (_display, _, window) => {
      Dwindle.pop(window);
    });
    this.connections.push(() => this.display.disconnect(windowLeft));

    const windowGrabbed = this.display.connect_after("grab-op-begin", (_display, window, operation) => {
      if (
        operation === Meta.GrabOp.MOVING ||
        operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
        operation === Meta.GrabOp.KEYBOARD_MOVING
      ) {
        Dwindle.pop(window);
      }
    });
    this.connections.push(() => this.display.disconnect(windowGrabbed));

    const windowReleased = this.display.connect_after("grab-op-end", (_display, window, operation) => {
      if (
        operation === Meta.GrabOp.MOVING ||
        operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
        operation === Meta.GrabOp.KEYBOARD_MOVING
      ) {
        Dwindle.push(window);
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
          Dwindle.resizeNeighbors(window);
        });
      }
    });
    this.connections.push(() => this.display.disconnect(windowReleased));

    this.display.list_all_windows().forEach((window) => {
      Dwindle.push(window);
    });
  }

  disable() {
    while (this.connections.length > 0) {
      this.connections.pop()!();
    }
  }
}