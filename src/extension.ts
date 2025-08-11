import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import WindowManager from './layout/dwindle.js';

export default class MyExtension extends Extension {
  private connections: number[] = [];

  constructor(metadata: ExtensionMetadata) {
    super(metadata);
  }

  enable() {
    const display = Shell.Global.get().display;

    const windowEntered = display.connect("window-entered-monitor",
      (display, _, windowMightNotShown) => {
        if (windowMightNotShown.title) return WindowManager.push(display, windowMightNotShown)

        const windowShown = windowMightNotShown.connect("shown",
          (window) => {
            windowMightNotShown.disconnect(windowShown);
            const actor: Meta.WindowActor = window.get_compositor_private();
            if (!actor) return WindowManager.push(display, window);

            const effectsCompleted = actor.connect("effects-completed", (_) => {
              actor.disconnect(effectsCompleted);
              WindowManager.push(display, window);
            })
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
          // Resize neighbors after a short delay to allow the resize operation to complete
          // Incomplete resize operations can happen if the window is resized too quickly
          setTimeout(() => {
            WindowManager.resizeNeighbors(display, window);
          }, 100);
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