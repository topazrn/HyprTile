import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import Dwindle from './layout/dwindle.js';
import { IPoint } from './util/bsp.js';

export default class MyExtension extends Extension {
  private connections: number[] = [];
  private shell = Shell.Global.get();
  private display = this.shell.display;

  constructor(metadata: ExtensionMetadata) {
    super(metadata);
  }

  enable() {
    const windowEntered = this.display.connect_after("window-entered-monitor", (display, _, windowMightNotShown) => {
      const [pointerX, pointerY, mod] = this.shell.get_pointer();
      const point: IPoint = { x: pointerX, y: pointerY };

      const windowChangedWorkspace = windowMightNotShown.connect_after("workspace-changed", (window) => {
        Dwindle.pop(window);
        Dwindle.push(window);
      });

      const windowClosed = windowMightNotShown.connect_after("unmanaged", () => {
        windowMightNotShown.disconnect(windowChangedWorkspace);
        windowMightNotShown.disconnect(windowClosed);
      });

      if (windowMightNotShown.title) {
        Dwindle.push(windowMightNotShown, point);
        return;
      }

      const windowShown = windowMightNotShown.connect_after("shown",
        (window) => {
          windowMightNotShown.disconnect(windowShown);
          const actor: Meta.WindowActor = window.get_compositor_private();

          const effectsCompleted = actor.connect_after("effects-completed", (_) => {
            actor.disconnect(effectsCompleted);
            Dwindle.push(window, point);
          })
        }
      );
    });

    const windowLeft = this.display.connect_after("window-left-monitor",
      (display, _, window) => Dwindle.pop(window)
    );

    const windowGrabbed = this.display.connect_after("grab-op-begin",
      (display, window, operation) => {
        if (
          operation === Meta.GrabOp.MOVING ||
          operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
          operation === Meta.GrabOp.KEYBOARD_MOVING
        ) {
          Dwindle.pop(window);
        }
      }
    );

    const windowReleased = this.display.connect_after("grab-op-end",
      (display, window, operation) => {
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
          // Resize neighbors after a short delay to allow the resize operation to complete
          // Incomplete resize operations can happen if the window is resized too quickly
          setTimeout(() => {
            Dwindle.resizeNeighbors(window);
          }, 100);
        }
      }
    );

    this.connections.push(windowEntered);
    this.connections.push(windowLeft);
    this.connections.push(windowReleased);
    this.connections.push(windowGrabbed);

    this.display.list_all_windows().forEach((window) => {
      Dwindle.push(window);
    });
  }

  disable() {
    const display = Shell.Global.get().display;
    this.connections.forEach((connection) => {
      display.disconnect(connection);
    });
    this.connections = [];
  }
}