import type Gio from "gi://Gio";
import type Meta from "gi://Meta";
import * as DwindleUtil from "../util/dwindle.js";
import * as MasterUtil from "../util/master.js";
import type { IGeometry, IPoint } from "../util/geometry.js";
import { getWorkArea } from "../util/helpers.js";

export abstract class BaseLayout {
  readonly key: string;
  readonly workspace: number;
  readonly monitor: number;
  rootNode: DwindleUtil.BspNode | MasterUtil.IRootNode | null;
  readonly settings: Gio.Settings;
  workArea: IGeometry;
  defaultSplitRatio: number = 0.5;
  readonly minSplitRatio: number = 0.1;

  constructor(key: string, settings: Gio.Settings) {
    this.key = key;
    const [workspace, monitor] = key.split("-").map(Number);
    this.workspace = workspace;
    this.monitor = monitor;
    this.rootNode = null;
    this.settings = settings;
    this.workArea = getWorkArea(this.workspace, this.monitor);
  }

  abstract push(newWindow: Meta.Window, point?: IPoint): Promise<void>;
  abstract pop(oldWindow: Meta.Window): Promise<void>;
  abstract resizeChildren(node?: DwindleUtil.BspNode): Promise<void>;
  abstract resizeNeighbors(window: Meta.Window): Promise<void>;
  abstract findNodeFromWindowHandle(
    window: Meta.Window,
    rootNode?: DwindleUtil.BspNode,
  ): DwindleUtil.IWindowNode | MasterUtil.IWindowNode | null;
}
