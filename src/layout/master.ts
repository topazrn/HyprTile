import type Gio from "gi://Gio";
import type Meta from "gi://Meta";
import type { IGeometry, IPoint } from "../util/geometry.js";
import { removeGaps, resizeWindow } from "../util/helpers.js";
import * as MasterUtil from "../util/master.js";
import { BaseLayout } from "./base.js";

export default class MasterLayout extends BaseLayout {
  rootNode: MasterUtil.IRootNode | null;

  constructor(key: string, settings: Gio.Settings) {
    super(key, settings);
    this.rootNode = null;
    this.defaultSplitRatio = 0.6;
  }

  async push(newWindow: Meta.Window): Promise<void> {
    if (!this.rootNode) {
      this.rootNode = {
        masterIndex: 0,
        windows: [
          {
            windowHandle: newWindow,
            splitRatio: 1,
          },
        ],
      };
      return this.resizeChildren();
    }

    if (this.findNodeFromWindowHandle(newWindow)) {
      // This happens when GNOME Shell resumes after a suspend.
      // In this case, we should not push the window again.
      console.debug(
        `Window ${newWindow.title} already exists in workspace ${this.workspace}, monitor ${this.monitor}.`,
      );
      return;
    }

    const oldMaster = this.rootNode.windows[this.rootNode.masterIndex];
    const newMaster: MasterUtil.IWindowNode = {
      splitRatio: oldMaster.splitRatio,
      windowHandle: newWindow,
    };
    this.rootNode.windows.push(newMaster);
    this.rootNode.masterIndex = this.rootNode.windows.length - 1;
    oldMaster.splitRatio = 1 / this.rootNode.masterIndex;
    if (this.rootNode.windows.length === 2)
      newMaster.splitRatio = this.defaultSplitRatio;

    return this.resizeChildren();
  }

  async pop(oldWindow: Meta.Window): Promise<void> {
    if (!this.rootNode) throw new Error("rootNode is null.");

    if (this.rootNode.windows.length === 1) {
      this.rootNode = null;
      return;
    }

    const node = this.findNodeFromWindowHandle(oldWindow);
    if (!node) throw new Error("node is null.");
    const nodeIndex = this.rootNode.windows.indexOf(node);
    if (nodeIndex === -1) throw new Error("nodeIndex is -1.");

    let removedSlaveNode: MasterUtil.IWindowNode;

    if (nodeIndex === this.rootNode.masterIndex) {
      removedSlaveNode = this.rootNode.windows.splice(
        Math.abs(this.rootNode.masterIndex - 1),
        1,
      )[0];
      node.windowHandle = removedSlaveNode.windowHandle;
      this.rootNode.masterIndex = this.rootNode.windows.indexOf(node);
    } else {
      removedSlaveNode = this.rootNode.windows.splice(nodeIndex, 1)[0];
    }

    return this.resizeChildren();
  }

  // Resize the descendants of the node recursively
  // Assuming that the geometry of the node is already set correctly
  async resizeChildren(): Promise<void> {
    if (!this.rootNode) throw new Error("rootNode is null.");
    const geometries = this.getGeometries();
    try {
      await Promise.all(
        this.rootNode.windows.map((node, index) =>
          resizeWindow(
            node.windowHandle,
            geometries[index],
            this.workArea,
            this.settings,
          ),
        ),
      );
    } catch (e) {
      console.debug(e);
    }

    console.debug("");
    this.printLayout(geometries);
  }

  async resizeNeighbors(window: Meta.Window): Promise<void> {
    if (!this.rootNode) throw new Error("rootNode is null.");

    const node = this.findNodeFromWindowHandle(window);
    if (!node) {
      console.debug(
        `No node found for window ${window.title} in workspace ${this.workspace}, monitor ${this.monitor}.`,
      );
      return;
    }

    const newGeometry = removeGaps(
      window.get_frame_rect(),
      this.workArea,
      this.settings.get_int("gaps-in"),
      this.settings.get_int("gaps-out"),
    );

    MasterUtil.adjustSplitRatio(
      this.rootNode,
      node,
      newGeometry,
      this.workArea,
      this.minSplitRatio,
    );

    await this.resizeChildren();
  }

  findNodeFromWindowHandle(
    targetWindowHandle: Meta.Window,
  ): MasterUtil.IWindowNode | null {
    if (!this.rootNode) throw new Error("rootNode is null.");

    return (
      this.rootNode.windows.find(
        (windows) => windows.windowHandle === targetWindowHandle,
      ) ?? null
    );
  }

  getGeometries(): IGeometry[] {
    if (!this.rootNode) throw new Error("rootNode is null.");
    if (this.rootNode.windows.length === 0) throw new Error("no windows.");
    if (this.rootNode.windows.length === 1) return [this.workArea];

    this.normalizeSlaveRatios();

    const geometries: IGeometry[] = [];
    const masterNode = this.rootNode.windows[this.rootNode.masterIndex];
    const x = this.workArea.x + this.workArea.width * masterNode.splitRatio;
    let slaveRatioSum = 0;

    console.debug("Length: ", this.rootNode.windows.length);
    for (let index = 0; index < this.rootNode.windows.length; index++) {
      console.debug("Index: ", index);
      const node = this.rootNode.windows[index];

      if (index === this.rootNode.masterIndex) {
        geometries.push({
          x: this.workArea.x,
          y: this.workArea.y,
          width: this.workArea.width * node.splitRatio,
          height: this.workArea.height,
        });
        continue;
      }

      geometries.push({
        x: x,
        y: this.workArea.y + this.workArea.height * slaveRatioSum,
        width: this.workArea.width - x,
        height: this.workArea.height * node.splitRatio,
      });

      slaveRatioSum += node.splitRatio;
    }

    return geometries;
  }

  normalizeSlaveRatios() {
    if (!this.rootNode) throw new Error("rootNode is null.");

    if (this.rootNode.windows.some((n) => n.splitRatio <= 0)) {
      throw new Error("Input list must contain only positive numbers.");
    }

    const slaveSplitRatio = 1 / (this.rootNode.windows.length - 1);
    for (let index = 0; index < this.rootNode.windows.length; index++) {
      if (index === this.rootNode.masterIndex) continue;
      const window = this.rootNode.windows[index];
      window.splitRatio = slaveSplitRatio;
    }
  }
  
  printLayout(geometries: IGeometry[]): void {
    if (!this.rootNode) throw new Error("rootNode is null.");

    console.debug(
      `Master Root (Ratio: ${this.rootNode.windows[this.rootNode.masterIndex].splitRatio})`,
    );
  
    if (this.rootNode.windows.length === 0) return;
  
    const master = this.rootNode.windows[this.rootNode.masterIndex];
    const masterGeometry = geometries[this.rootNode.masterIndex];
    console.debug(
      `  ${this.rootNode.windows.length > 1 ? "├──" : "└──"} Master Window: Title: ${master.windowHandle.title} ${master.windowHandle.get_pid()}) - Geo: (${masterGeometry.x},${masterGeometry.y},${masterGeometry.width},${masterGeometry.height})`,
    );
  
    if (this.rootNode.windows.length === 1) return;
  
    console.debug(`  └── Slave Windows: `);
    for (let index = 0; index < this.rootNode.windows.length - 1; index++) {
      if (index == this.rootNode.masterIndex) continue;
      const window = this.rootNode.windows[index];
      const windowGeometry = geometries[index];
      console.debug(
        `    ${index === this.rootNode.windows.length - 1 ? "└──" : "├──"} Title: ${window.windowHandle.title} ${window.windowHandle.get_pid()}) - Ratio (${window.splitRatio}) - Geo: (${windowGeometry.x},${windowGeometry.y},${windowGeometry.width},${windowGeometry.height})`,
      );
    }
  }
}
