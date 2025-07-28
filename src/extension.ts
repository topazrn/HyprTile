import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import WindowManager from './core/wm.js';

export default class MyExtension extends Extension {
  private connections: number[] = [];

  constructor(metadata: ExtensionMetadata) {
    super(metadata);
  }

  enable() {
    const display = Shell.Global.get().display;

    const windowEntered = display.connect("window-entered-monitor",
      (display, _, windowNotShown) => {
        const windowShown = windowNotShown.connect("shown",
          (window) => {
            display.disconnect(windowShown);
            WindowManager.push(display, window)
          }
        );
      }
    );

    const windowLeft = display.connect("window-left-monitor",
      (display, _, window) => WindowManager.pop(display, window)
    );

    const windowGrabbed = display.connect("grab-op-begin",
      (display, window, operation) => {
        if (
          operation === Meta.GrabOp.MOVING ||
          operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
          operation === Meta.GrabOp.KEYBOARD_MOVING
        ) {
          WindowManager.pop(display, window);
        }
      }
    );

    const windowReleased = display.connect("grab-op-end",
      (display, window, operation) => {
        if (
          operation === Meta.GrabOp.MOVING ||
          operation === Meta.GrabOp.MOVING_UNCONSTRAINED ||
          operation === Meta.GrabOp.KEYBOARD_MOVING
        ) {
          WindowManager.push(display, window);
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
          WindowManager.resizeNeighbors(display, window);
        }
      }
    );

    this.connections.push(windowEntered);
    this.connections.push(windowLeft);
    this.connections.push(windowReleased);
    this.connections.push(windowGrabbed);

    display.list_all_windows().forEach((window) => {
      WindowManager.push(display, window);
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