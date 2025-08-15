import Meta from "gi://Meta";
import {
    BspNode,
    createSplitNode,
    createWindowNode,
    findNodeFromWindowHandle, printBspTree, adjustSplitRatio,
    windowAtPointer,
    IGeometry,
    IPoint
} from "../util/bsp.js";
import { removeGaps, resizeWindow } from "../util/helpers.js";
import { WindowManager } from "./wm.js";

export default class Dwindle extends WindowManager {
    push(newWindow: Meta.Window, point?: IPoint): void {
        if (!this.rootNode) {
            const geometry = this.workArea;
            this.rootNode = createWindowNode(
                newWindow,
                geometry,
                null
            )
            this.resizeChildren(this.rootNode);
            return;
        }

        if (findNodeFromWindowHandle(this.rootNode, newWindow)) {
            // This happens when GNOME Shell resumes after a suspend.
            // In this case, we should not push the window again.
            console.debug(`Window ${newWindow.title} already exists in workspace ${this.workspace}, monitor ${this.monitor}.`);
            return;
        }

        let targetX = 0;
        let targetY = 0;
        if (point) {
            targetX = point.x;
            targetY = point.y;
        } else {
            const rect = newWindow.get_frame_rect();
            targetX = rect.x + rect.width / 2;
            targetY = rect.y + rect.height / 2;
        }
        targetX = Math.clamp(targetX, this.workArea.x, this.workArea.x + this.workArea.width - 1);
        targetY = Math.clamp(targetY, this.workArea.y, this.workArea.y + this.workArea.height - 1);

        let node = windowAtPointer(this.rootNode, targetX, targetY);
        console.debug(`Pointer at (${targetX}, ${targetY})`);
        if (!node) return; // Already handled at the beginning of the function

        const isHorizontal = node.geometry.width > node.geometry.height; // Determine split direction based on geometry aspect ratio
        const splitDirection = isHorizontal ? 'vertical' : 'horizontal';
        // right is right for vertical split, right is bottom for horizontal split
        // left is left for vertical split, left is top for horizontal split
        const hover = isHorizontal ?
            (targetX < node.geometry.x + node.geometry.width * this.defaultSplitRatio ? 'left' : 'right') :
            (targetY < node.geometry.y + node.geometry.height * this.defaultSplitRatio ? 'left' : 'right');

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
            oldGeometry.width = oldGeometry.width - newGeometry.width;
            if (hover === 'left') {
                oldGeometry.x = node.geometry.x + newGeometry.width;
            } else {
                newGeometry.x = node.geometry.x + oldGeometry.width;
            }
        } else {
            newGeometry.height = newGeometry.height * this.defaultSplitRatio;
            oldGeometry.height = oldGeometry.height - newGeometry.height;
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
            splitDirection,
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
                console.debug(`A window node don't have children, so idk how you can get this error.`);
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

        this.resizeChildren(parent); // Resize the children of the new split node

        console.debug("");
        printBspTree(this.rootNode, '  ');
        console.debug("");
    }

    pop(oldWindow: Meta.Window): void {
        if (!this.rootNode) {
            console.debug(`No root node exists for ${this.key}, cannot pop window.`);
            return;
        }

        const node = findNodeFromWindowHandle(this.rootNode, oldWindow);
        if (!node) {
            console.debug(`No node found for window ${oldWindow.title} in workspace ${this.workspace}, monitor ${this.monitor}.`);
            return;
        }

        if (!node.parent) {
            this.rootNode = null;
            return;
        }

        if (node.parent.type === 'window') {
            console.debug(`Cannot pop a window node that is a child of another window node.`);
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

        console.debug("");
        printBspTree(this.rootNode, '  ');
        console.debug("");
    }

    // Resize the descendants of the node recursively
    // Assuming that the geometry of the node is already set correctly
    resizeChildren(node: BspNode): void {
        if (node.type === 'window') {
            resizeWindow(node.windowHandle, node.geometry, this.workArea, this.settings);
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
                width: node.geometry.width - node.leftChild.geometry.width,
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
                height: node.geometry.height - node.leftChild.geometry.height,
            };
        }

        // Resize both children too
        this.resizeChildren(node.leftChild);
        this.resizeChildren(node.rightChild);
    }

    resizeNeighbors(window: Meta.Window): void {
        if (!this.rootNode) {
            console.debug(`No root node exists for ${this.key}, cannot resize neighboring window.`);
            return;
        }

        const node = findNodeFromWindowHandle(this.rootNode, window)
        if (!node) {
            console.debug(`No node found for window ${window.title} in workspace ${this.workspace}, monitor ${this.monitor}.`);
            return;
        }

        if (node.type !== 'window') {
            console.debug(`Cannot resize neighbors of a non-window node.`);
            return;
        }

        if (!node.parent) {
            console.debug(`Cannot resize neighbors of a root node.`);
            return;
        }

        if (node.parent.type === 'window') {
            console.debug(`A window node don't have children, so idk how you can get this error.`);
            return;
        }

        const newGeometry = removeGaps(window.get_frame_rect(), this.workArea, this.settings.get_int("gaps-in"), this.settings.get_int("gaps-out"));

        adjustSplitRatio(node, node.parent, newGeometry, this.minSplitRatio);

        if (node.parent.parent?.type === 'split') {
            if (node.parent.parent.splitDirection === node.parent.splitDirection) {
                this.resizeChildren(node.parent);
            } else {
                adjustSplitRatio(node.parent, node.parent.parent, newGeometry, this.minSplitRatio);
                this.resizeChildren(node.parent.parent);
            }
        } else {
            this.resizeChildren(node.parent);
        }

        console.debug("");
        printBspTree(this.rootNode, '  ');
        console.debug("");
    }
}