import Shell from "gi://Shell";
import Meta from "gi://Meta";
import Gio from "gi://Gio";
import { keyOf, windowFilter } from "../util/helpers.js";
import { BspNode, findNodeFromWindowHandle, IGeometry, IPoint } from "../util/bsp.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export class WindowManager {
    private static instances = new Map<string, WindowManager>();

    public static push(window: Meta.Window, point?: IPoint): void {
        if (!windowFilter(window)) return;
        const key = keyOf(window);
        let wm = this.instances.get(key);
        if (!wm) {
            wm = new this(key);
            this.instances.set(key, wm);
        }
        wm.push(window, point);
    }

    public static pop(window: Meta.Window, key?: string): void {
        if (key) {
            let wm = this.instances.get(key);
            if (!wm) {
                console.debug(`No WindowManager instance found for ${key}, cannot pop window.`);
                return;
            }
            return wm.pop(window);
        }

        for (const [key, wm] of this.instances) {
            if (!wm.rootNode) continue;
            if (findNodeFromWindowHandle(wm.rootNode, window)) {
                wm.pop(window)
                return;
            }
        }
    }

    public static resizeNeighbors(window: Meta.Window) {
        const key = keyOf(window);
        let wm = this.instances.get(key);
        if (!wm) {
            console.debug(`No WindowManager instance found for ${key}, cannot resize neighboring window.`);
            return;
        }
        wm.resizeNeighbors(window);
    }

    readonly key: string;
    readonly workspace: number;
    readonly monitor: number;
    rootNode: BspNode | null;
    readonly workArea: IGeometry;
    readonly settings: Gio.Settings;
    readonly defaultSplitRatio: number = 0.5;
    readonly minSplitRatio: number = 0.1;

    constructor(key: string) {
        this.key = key;
        const [workspace, monitor] = key.split('-').map(Number);
        this.workspace = workspace;
        this.monitor = monitor;
        this.rootNode = null;
        this.workArea = this.getWorkArea();
        const extension = Extension.lookupByUUID("hyprtile@topazrn.com")!;
        this.settings = extension.getSettings();
    }

    getWorkArea(): IGeometry {
        const display = Shell.Global.get().display
        const workspaceManager = display.get_workspace_manager();
        const workspace = workspaceManager.get_workspace_by_index(this.workspace);
        if (!workspace) {
            console.warn(`No workspace found for index ${this.workspace}`);
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return workspace.get_work_area_for_monitor(this.monitor);
    }

    push(newWindow: Meta.Window, point?: IPoint): void {
        throw new Error("Must be implemented in the subclass.");
    }

    pop(oldWindow: Meta.Window): void {
        throw new Error("Must be implemented in the subclass.");
    }

    resizeChildren(node: BspNode): void {
        throw new Error("Must be implemented in the subclass.");
    }

    resizeNeighbors(window: Meta.Window): void {
        throw new Error("Must be implemented in the subclass.");
    }
}