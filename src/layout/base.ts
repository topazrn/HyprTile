import Meta from "gi://Meta";
import Gio from "gi://Gio";
import { getWorkArea } from "../util/helpers.js";
import { BspNode, IGeometry, IPoint } from "../util/bsp.js";

export abstract class BaseLayout {
    readonly key: string;
    readonly workspace: number;
    readonly monitor: number;
    rootNode: BspNode | null;
    readonly settings: Gio.Settings;
    readonly workArea: IGeometry;
    readonly defaultSplitRatio: number = 0.5;
    readonly minSplitRatio: number = 0.1;

    constructor(key: string, settings: Gio.Settings) {
        this.key = key;
        const [workspace, monitor] = key.split('-').map(Number);
        this.workspace = workspace;
        this.monitor = monitor;
        this.rootNode = null;
        this.settings = settings;
        this.workArea = getWorkArea(this.workspace, this.monitor);
    }

    abstract push(newWindow: Meta.Window, point?: IPoint): void;
    abstract pop(oldWindow: Meta.Window): void;
    abstract resizeChildren(node: BspNode): void;
    abstract resizeNeighbors(window: Meta.Window): void;
}