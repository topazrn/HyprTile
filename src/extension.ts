import {
  Extension,
  type ExtensionMetadata,
} from "resource:///org/gnome/shell/extensions/extension.js";
import HyprTile from "./app.js";

export default class MyExtension extends Extension {
  private app: HyprTile;

  constructor(settings: ExtensionMetadata) {
    super(settings);
    this.app = new HyprTile(this.getSettings());
  }

  enable() {
    this.app.start();
  }

  disable() {
    this.app.release();
  }
}
