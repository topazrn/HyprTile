import type Gio from "gi://Gio";
import type Meta from "gi://Meta";
import Shell from "gi://Shell";
import { findNodeFromWindowHandle, type IPoint } from "../util/bsp.js";
import { keyOf, windowFilter } from "../util/helpers.js";
import type { BaseLayout } from "./base.js";
import DwindleLayout from "./dwindle.js";
import MasterLayout from "./master.js";

export class LayoutManager {
  private readonly instances = new Map<string, BaseLayout>();
  private readonly settings: Gio.Settings;

  constructor(settings: Gio.Settings) {
    this.settings = settings;
  }

  public resizeAll() {
    for (const [_key, wm] of this.instances) {
      if (!wm.rootNode) continue;
      wm.resizeChildren(wm.rootNode);
    }
  }

  public reinitializeLayouts() {
    const windows = Shell.Global.get().display.list_all_windows();
    windows.forEach((window) => this.pop(window));
    windows.forEach((window) => this.push(window));
  }

  public push(window: Meta.Window, point?: IPoint): void {
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

  public pop(window: Meta.Window): void {
    for (const [_key, wm] of this.instances) {
      if (!wm.rootNode) continue;
      if (findNodeFromWindowHandle(wm.rootNode, window)) {
        wm.pop(window);
        return;
      }
    }
  }

  public resizeNeighbors(window: Meta.Window) {
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
