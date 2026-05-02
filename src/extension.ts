import {
  Extension,
} from "resource:///org/gnome/shell/extensions/extension.js";
import HyprTile from "./app.js";

export default class MyExtension extends Extension {
  private app?: HyprTile;

  enable() {
    this.app = new HyprTile(this.getSettings());
    this.app.start();
  }

  disable() {
    this.app?.release();
  }
}
