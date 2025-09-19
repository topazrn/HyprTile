import type Gio from "gi://Gio";
import type Meta from "gi://Meta";
import Shell from "gi://Shell";
import type { IPoint } from "../util/geometry.js";
import { getWorkArea, keyOf, windowFilter } from "../util/helpers.js";
import type { BaseLayout } from "./base.js";
import DwindleLayout from "./dwindle.js";
import MasterLayout from "./master.js";

export class LayoutManager {
  private readonly instances = new Map<string, BaseLayout>();
  private readonly settings: Gio.Settings;

  constructor(settings: Gio.Settings) {
    this.settings = settings;
  }

  updateWorkArea() {
    for (const [_key, wm] of this.instances) {
      wm.workArea = getWorkArea(wm.workspace, wm.monitor);
    }
  }

  resizeAll() {
    for (const [_key, wm] of this.instances) {
      if (!wm.rootNode) continue;
      if (wm instanceof DwindleLayout) {
        wm.resizeChildren(wm.rootNode);
      } else {
        wm.resizeChildren();
      }
    }
  }

  reinitializeLayouts() {
    const windows = Shell.Global.get().display.list_all_windows();
    windows.forEach((window) => this.pop(window));
    windows.forEach((window) => this.push(window));
  }

  push(window: Meta.Window, point?: IPoint): void {
    if (!windowFilter(window)) return;
    const key = keyOf(window);
    let wm = this.instances.get(key);
    if (!wm) {
      if (this.settings.get_string("layout") === "dwindle") {
        wm = new DwindleLayout(key, this.settings);
      } else {
        wm = new MasterLayout(key, this.settings);
      }
      this.instances.set(key, wm);
    }
    wm.push(window, point);
  }

  async pop(window: Meta.Window): Promise<void> {
    for (const [_key, wm] of this.instances) {
      if (!wm.rootNode) continue;
      if (
        wm instanceof DwindleLayout &&
        !wm.findNodeFromWindowHandle(window, wm.rootNode)
      ) {
        continue;
      }
      if (wm instanceof MasterLayout && !wm.findNodeFromWindowHandle(window)) {
        continue;
      }
      try {
        await wm.pop(window);
      } catch {}
      if (wm.rootNode) return;
      this.instances.delete(wm.key);
      return;
    }
  }

  resizeNeighbors(window: Meta.Window) {
    const key = keyOf(window);
    const wm = this.instances.get(key);
    if (!wm) {
      console.debug(
        `No WindowManager instance found for ${key}, cannot resize neighboring window.`,
      );
      return;
    }
    wm.resizeNeighbors(window);
  }
}
