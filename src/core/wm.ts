import Meta from "gi://Meta";
import Shell from "gi://Shell";
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {
    BspNode,
    createSplitNode,
    createWindowNode,
    findNodeFromWindowHandle,
    findWindowAtCursor,
    IGeometry,
    IWindowNode,
} from "../util/bsp.js";
import { ConsoleLike } from "@girs/gnome-shell/extensions/extension";

export default class WindowManager {
    private static instances = new Map<string, WindowManager>();

    private static getInstance(display: Meta.Display): [WindowManager | undefined, string] {
        const workspace = display.get_workspace_manager().get_active_workspace().index();
        const monitor = display.get_current_monitor();
        const key = `${workspace}-${monitor}`;
        return [this.instances.get(key), key];
    }

    public static push(display: Meta.Display, newWindow: Meta.Window): void {
        let [wm, key] = this.getInstance(display);
        if (!wm) {
            wm = new WindowManager(key);
            this.instances.set(key, wm);
        }
        wm.push(display, newWindow);
    }

    public static pop(display: Meta.Display, oldWindow: Meta.Window): void {
        let [wm, key] = this.getInstance(display);
        if (!wm) {
            const logger = Extension.lookupByUUID("hyprtile@topazrn.com")!.getLogger()
            logger.warn(`No WindowManager instance found for ${key}, cannot pop window.`);
            return;
        }
        wm.pop(display, oldWindow);
    }

    private key: string;
    private workspace: number;
    private monitor: number;
    private rootNode: BspNode | null;
    private logger: ConsoleLike;

    constructor(key: string) {
        this.key = key;
        const [workspace, monitor] = key.split('-').map(Number);
        this.workspace = workspace;
        this.monitor = monitor;
        this.rootNode = null;
        this.logger = Extension.lookupByUUID("hyprtile@topazrn.com")!.getLogger()
    }

    private workArea(display: Meta.Display): IGeometry {
        const workspaceManager = display.get_workspace_manager();
        const workspace = workspaceManager.get_workspace_by_index(this.workspace);
        if (!workspace) {
            this.logger.warn(`No workspace found for index ${this.workspace}`);
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return workspace.get_work_area_for_monitor(this.monitor);
    }

    private push(display: Meta.Display, newWindow: Meta.Window): void {
        if (!this.rootNode) {
            const geometry = this.workArea(display);
            this.rootNode = createWindowNode(
                newWindow,
                geometry,
                null
            )
            return;
        }

        // Get mouse position to determine which node to add the new window to
        const [pointerX, pointerY, _] = Shell.Global.get().get_pointer();
        let node: BspNode | null = findWindowAtCursor(this.rootNode, pointerX, pointerY);
        if (!node) return; // Already handled at the beginning of the function

        const splitRatio = 0.5; // Default split ratio, can be adjusted
        const isHorizontal = node.geometry.width > node.geometry.height; // Determine split direction based on geometry aspect ratio
        const splitDirection = isHorizontal ? 'vertical' : 'horizontal';
        // right is right for vertical split, right is bottom for horizontal split
        // left is left for vertical split, left is top for horizontal split
        const hover = isHorizontal ?
            (pointerX < node.geometry.x + node.geometry.width * 0.5 ? 'left' : 'right') :
            (pointerY < node.geometry.y + node.geometry.height * 0.5 ? 'left' : 'right');

        const oldGeometry: IGeometry = {
            x: node.geometry.x,
            y: node.geometry.y,
            width: node.geometry.width,
            height: node.geometry.height
        };
        const newGeometry: IGeometry = {
            x: node.geometry.x,
            y: node.geometry.y,
            width: node.geometry.width,
            height: node.geometry.height
        };

        if (isHorizontal) {
            newGeometry.width = newGeometry.width * splitRatio;
            oldGeometry.width = oldGeometry.width * splitRatio;
            if (hover === 'left') {
                oldGeometry.x = node.geometry.x + newGeometry.width;
            } else {
                newGeometry.x = node.geometry.x + oldGeometry.width;
            }
        } else {
            newGeometry.height = newGeometry.height * splitRatio;
            oldGeometry.height = oldGeometry.height * splitRatio;
            if (hover === 'left') {
                oldGeometry.y = node.geometry.y + newGeometry.height;
            } else {
                newGeometry.y = node.geometry.y + oldGeometry.height;
            }
        }

        const oldNode = createWindowNode(
            node.windowHandle,
            oldGeometry,
            null
        );
        const newNode = createWindowNode(
            newWindow,
            newGeometry,
            null
        );
        const parent = createSplitNode(
            splitDirection, // Assuming horizontal split for simplicity
            splitRatio,
            hover === 'left' ? newNode : oldNode,
            hover === 'left' ? oldNode : newNode,
            node.geometry,
            null
        );
        oldNode.parent = parent;
        newNode.parent = parent;

        if (!node.parent) {
            // If the node has no parent, it becomes the new root
            this.rootNode = parent;
        } else {
            // Replace the node in its parent's children
            if (node.parent.type === 'window') return;

            const grandParent = node.parent;
            if (grandParent.leftChild === node) {
                grandParent.leftChild = parent;
            } else {
                grandParent.rightChild = parent;
            }
            parent.parent = grandParent;
        }
    }

    private pop(display: Meta.Display, oldWindow: Meta.Window): void {
        if (!this.rootNode) {
            this.logger.warn(`No root node exists for ${this.key}, cannot pop window.`);
            return;
        }

        const node = findNodeFromWindowHandle(this.rootNode, oldWindow);
        if (!node) {
            this.logger.warn(`No node found for window ${oldWindow.title} in workspace ${this.workspace}, monitor ${this.monitor}.`);
            return;
        }
        
        if (!node.parent) {
            this.rootNode = null;
            return;
        }

        if (node.parent.type === 'window') {
            this.logger.warn(`Cannot pop a window node that is a child of another window node.`);
            return;
        }

        const parent = node.parent;
        let remainingChild: IWindowNode;
        if (parent.leftChild === node) {
            remainingChild = parent.rightChild as IWindowNode;
        } else {
            remainingChild = parent.leftChild as IWindowNode;
        }

        const grandParent = parent.parent;
        if (grandParent === null) {
            // If the parent has no grandparent, we are at the root
            remainingChild.parent = null;
            this.rootNode = remainingChild;
        } else {
            // Replace the parent in its grandparent's children
            if (grandParent.type === 'window') return;
            if (grandParent.leftChild === parent) {
                grandParent.leftChild = remainingChild;
            } else {
                grandParent.rightChild = remainingChild;
            }
            remainingChild.parent = grandParent;
        }
        remainingChild.geometry = parent.geometry; // Update geometry to parent's geometry
        remainingChild.windowHandle.move_resize_frame(
            true,
            remainingChild.geometry.x,
            remainingChild.geometry.y,
            remainingChild.geometry.width,
            remainingChild.geometry.height
        );
    }
}