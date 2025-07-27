import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
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

    const windowReleased = display.connect("grab-op-end",
      (display, window) => WindowManager.push(display, window)
    );
    
    const windowLeft = display.connect("window-left-monitor",
      (display, _, window) => WindowManager.pop(display, window)
    );
    
    const windowGrabbed = display.connect("grab-op-begin",
      (display, window) => WindowManager.pop(display, window)
    );
    
    this.connections.push(windowEntered);
    this.connections.push(windowReleased);
    this.connections.push(windowLeft);
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