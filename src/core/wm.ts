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
    ISplitNode,
    printBspTree,
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
        wm.push(newWindow);
    }

    public static pop(display: Meta.Display, oldWindow: Meta.Window): void {
        let [wm, key] = this.getInstance(display);
        if (!wm) {
            const logger = Extension.lookupByUUID("hyprtile@topazrn.com")!.getLogger()
            logger.warn(`No WindowManager instance found for ${key}, cannot pop window.`);
            return;
        }
        wm.pop(oldWindow);
    }

    public static resizeNeighbors(display: Meta.Display, window: Meta.Window) {
        let [wm, key] = this.getInstance(display);
        if (!wm) {
            const logger = Extension.lookupByUUID("hyprtile@topazrn.com")!.getLogger()
            logger.warn(`No WindowManager instance found for ${key}, cannot resize neighboring window.`);
            return;
        }
        wm.resizeNeighbors(window);
    }

    private readonly key: string;
    private readonly workspace: number;
    private readonly monitor: number;
    private rootNode: BspNode | null;
    private readonly workArea: IGeometry;
    private readonly logger: ConsoleLike;
    private readonly defaultSplitRatio: number = 0.5;
    private readonly minSplitRatio: number = 0.1; 

    constructor(key: string) {
        this.key = key;
        const [workspace, monitor] = key.split('-').map(Number);
        this.workspace = workspace;
        this.monitor = monitor;
        this.rootNode = null;
        this.workArea = this.getWorkArea();
        this.logger = Extension.lookupByUUID("hyprtile@topazrn.com")!.getLogger()
    }

    private getWorkArea(): IGeometry {
        const display = Shell.Global.get().display
        const workspaceManager = display.get_workspace_manager();
        const workspace = workspaceManager.get_workspace_by_index(this.workspace);
        if (!workspace) {
            this.logger.warn(`No workspace found for index ${this.workspace}`);
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return workspace.get_work_area_for_monitor(this.monitor);
    }

    private push(newWindow: Meta.Window): void {
        if (!this.rootNode) {
            const geometry = this.workArea;
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
            newGeometry.width = newGeometry.width * this.defaultSplitRatio;
            oldGeometry.width = oldGeometry.width * this.defaultSplitRatio;
            if (hover === 'left') {
                oldGeometry.x = node.geometry.x + newGeometry.width;
            } else {
                newGeometry.x = node.geometry.x + oldGeometry.width;
            }
        } else {
            newGeometry.height = newGeometry.height * this.defaultSplitRatio;
            oldGeometry.height = oldGeometry.height * this.defaultSplitRatio;
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
            this.defaultSplitRatio,
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
            if (node.parent.type === 'window') {
                this.logger.warn(`A window node don't have children, so idk how you can get this error.`);
                return;
            }

            // Replace the node in its parent's children
            const grandParent = node.parent;
            if (grandParent.leftChild === node) {
                grandParent.leftChild = parent;
            } else {
                grandParent.rightChild = parent;
            }
            parent.parent = grandParent;
        }

        this.logger.log("");
        printBspTree(this.logger, this.rootNode, '  ');
        this.logger.log("");
    }

    private pop(oldWindow: Meta.Window): void {
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
        let remainingChild: BspNode;
        if (parent.leftChild === node) {
            remainingChild = parent.rightChild;
        } else {
            remainingChild = parent.leftChild;
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

        this.resizeChildren(remainingChild); // Resize the children of the remaining node

        this.logger.log("");
        printBspTree(this.logger, this.rootNode, '  ');
        this.logger.log("");
    }

    // Resize the descendants of the node recursively
    // Assuming that the geometry of the node is already set correctly
    // This is used to resize the windows after a pop operation
    private resizeChildren(node: BspNode): void {
        if (node.type === 'window') {
            const { windowHandle, geometry } = node;
            windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
            windowHandle.move_resize_frame(true, geometry.x, geometry.y, geometry.width, geometry.height);
            return;
        }

        if (node.splitDirection === 'vertical') {
            node.leftChild.geometry = {
                x: node.geometry.x,
                y: node.geometry.y,
                width: node.geometry.width * node.splitRatio,
                height: node.geometry.height
            };
            node.rightChild.geometry = {
                x: node.geometry.x + node.leftChild.geometry.width,
                y: node.geometry.y,
                width: node.geometry.width * (1 - node.splitRatio),
                height: node.geometry.height
            };
        } else {
            node.leftChild.geometry = {
                x: node.geometry.x,
                y: node.geometry.y,
                width: node.geometry.width,
                height: node.geometry.height * node.splitRatio
            };
            node.rightChild.geometry = {
                x: node.geometry.x,
                y: node.geometry.y + node.leftChild.geometry.height,
                width: node.geometry.width,
                height: node.geometry.height * (1 - node.splitRatio)
            };
        }

        // Resize both children too
        this.resizeChildren(node.leftChild);
        this.resizeChildren(node.rightChild);
    }

    private resizeNeighbors(window: Meta.Window): void {
        if (!this.rootNode) {
            this.logger.warn(`No root node exists for ${this.key}, cannot resize neighboring window.`);
            return;
        }

        const node = findNodeFromWindowHandle(this.rootNode, window)
        if (!node) {
            this.logger.warn(`No node found for window ${window.title} in workspace ${this.workspace}, monitor ${this.monitor}.`);
            return;
        }

        if (node.type !== 'window') {
            this.logger.warn(`Cannot resize neighbors of a non-window node.`);
            return;
        }

        if (!node.parent) {
            this.logger.warn(`Cannot resize neighbors of a root node.`);
            return;
        }

        if (node.parent.type === 'window') {
            this.logger.warn(`A window node don't have children, so idk how you can get this error.`);
            return;
        }

        const newGeometry = window.get_frame_rect();
        this.adjustSplitRatio(node, node.parent, newGeometry);

        this.logger.log("");
        printBspTree(this.logger, this.rootNode, '  ');
        this.logger.log("");
    }

    adjustSplitRatio(node: BspNode, parent: ISplitNode, newGeometry: IGeometry): void {
        const oldSplitRatio = parent.splitRatio;
        if (parent.splitDirection === 'vertical') {
            if (parent.leftChild === node) {
                parent.splitRatio = newGeometry.width / parent.geometry.width;
            } else {
                parent.splitRatio = (parent.geometry.width - newGeometry.width) / parent.geometry.width;
            }
        } else {
            if (parent.leftChild === node) {
                parent.splitRatio = (newGeometry.height) / parent.geometry.height;
            } else {
                parent.splitRatio = (parent.geometry.height - newGeometry.height) / parent.geometry.height;
            }
        }

        if (parent.splitRatio > 1 - this.minSplitRatio || parent.splitRatio < this.minSplitRatio) {
            this.logger.warn(`Split ratio ${parent.splitRatio} is out of bounds, using previous ratio.`);
            parent.splitRatio = oldSplitRatio;
        }

        if (parent.parent?.type === 'split') {
            if (parent.parent.splitDirection === parent.splitDirection) {
                this.resizeChildren(parent);
            } else {
                this.adjustSplitRatio(parent, parent.parent, newGeometry);
                this.resizeChildren(parent.parent);
            }
        } else {
            this.resizeChildren(parent);
        }
    }
}