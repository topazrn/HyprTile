import { ConsoleLike } from "@girs/gnome-shell/extensions/extension";
import Meta from "gi://Meta";

/**
 * Represents the geometric properties of a window or a screen region.
 */
export interface IGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Defines the possible directions for a split in the binary tree.
 * - 'horizontal': Divides a region into top and bottom sub-regions.
 * - 'vertical': Divides a region into left and right sub-regions.
 */
type SplitDirection = 'horizontal' | 'vertical';

/**
 * Represents a node in the Binary Space Partitioning (BSP) tree.
 * This is a base interface that both SplitNode and WindowNode will extend.
 */
interface IBspNode {
    type: 'split' | 'window'; // Discriminator to easily determine node type
    parent: BspNode | null; // Reference to the parent node, null for the root
    geometry: IGeometry; // The calculated screen area this node occupies
}

/**
 * Represents an internal node in the BSP tree.
 * A SplitNode divides its 'geometry' into two sub-regions.
 */
export interface ISplitNode extends IBspNode {
    type: 'split';
    splitDirection: SplitDirection;
    splitRatio: number; // A value between 0 and 1, e.g., 0.5 for a 50/50 split
    leftChild: BspNode; // The first sub-region/window
    rightChild: BspNode; // The second sub-region/window
}

/**
 * Represents a leaf node in the BSP tree.
 * A WindowNode directly contains a reference to an actual window.
 */
export interface IWindowNode extends IBspNode {
    type: 'window';
    windowHandle: Meta.Window; // A unique identifier for the actual window (e.g., its Wayland ID)
    // Additional window properties could go here, like title, class, etc.
    // windowTitle?: string;
    // windowClass?: string;
}

/**
 * A utility type to easily refer to any kind of BSP tree node.
 */
export type BspNode = ISplitNode | IWindowNode;

/**
 * Helper function to create a new window node.
 */
export function createWindowNode(windowHandle: Meta.Window, geometry: IGeometry, parent: BspNode | null = null): IWindowNode {
    windowHandle.unmaximize(Meta.MaximizeFlags.BOTH);
    windowHandle.move_resize_frame(true, geometry.x, geometry.y, geometry.width, geometry.height);

    return {
        type: 'window',
        windowHandle,
        geometry,
        parent,
    };
}

/**
 * Helper function to create a new split node.
 */
export function createSplitNode(
    splitDirection: SplitDirection,
    splitRatio: number,
    leftChild: BspNode,
    rightChild: BspNode,
    geometry: IGeometry,
    parent: BspNode | null = null
): ISplitNode {
    const splitNode: ISplitNode = {
        type: 'split',
        splitDirection,
        splitRatio,
        leftChild,
        rightChild,
        geometry,
        parent,
    };
    // Update children's parent pointers
    leftChild.parent = splitNode;
    rightChild.parent = splitNode;
    return splitNode;
}

/**
 * Determines if a given point (cursorX, cursorY) is within the bounds of a geometry.
 */
function isPointInGeometry(x: number, y: number, geometry: IGeometry): boolean {
    return x >= geometry.x && x < (geometry.x + geometry.width) &&
        y >= geometry.y && y < (geometry.y + geometry.height);
}

/**
 * Traverses the BSP tree to find the IWindowNode at the given cursor coordinates.
 * @param rootNode The root of the BSP tree (e.g., the workspace's root node).
 * @param cursorX The X coordinate of the cursor.
 * @param cursorY The Y coordinate of the cursor.
 * @returns The IWindowNode being hovered, or null if no window is found at the coordinates.
 */
export function findWindowAtCursor(rootNode: BspNode, cursorX: number, cursorY: number): IWindowNode | null {
    // If the cursor is not within the root node's geometry, no window can be found
    if (!isPointInGeometry(cursorX, cursorY, rootNode.geometry)) {
        return null;
    }

    if (rootNode.type === 'window') {
        // If it's a window node, and the cursor is within its geometry, return it
        return rootNode;
    } else {
        // If it's a split node, determine which child the cursor is in and recurse
        const splitNode = rootNode as ISplitNode; // Cast for type safety

        const { x, y, width, height } = splitNode.geometry;
        const { splitDirection, splitRatio, leftChild, rightChild } = splitNode;

        if (splitDirection === 'vertical') {
            // Vertical split: left and right children
            const splitX = x + width * splitRatio;
            if (cursorX < splitX) {
                return findWindowAtCursor(leftChild, cursorX, cursorY);
            } else {
                return findWindowAtCursor(rightChild, cursorX, cursorY);
            }
        } else {
            // Horizontal split: top and bottom children
            const splitY = y + height * splitRatio;
            if (cursorY < splitY) {
                return findWindowAtCursor(leftChild, cursorX, cursorY);
            } else {
                return findWindowAtCursor(rightChild, cursorX, cursorY);
            }
        }
    }
}

/**
 * Traverses the BSP tree to find a specific IWindowNode by its window handle.
 * Performs a Depth-First Search (DFS).
 * @param rootNode The root of the BSP tree (e.g., the workspace's root node).
 * @param targetWindowHandle The window handle to search for.
 * @returns The IWindowNode with the matching handle, or null if not found.
 */
export function findNodeFromWindowHandle(rootNode: BspNode, targetWindowHandle: Meta.Window): IWindowNode | null {
    if (rootNode.type === 'window') {
        // If it's a window node, check if its handle matches
        if (rootNode.windowHandle === targetWindowHandle) {
            return rootNode;
        }
    } else {
        // If it's a split node, recursively search in its children
        const splitNode = rootNode as ISplitNode;
        let foundNode: IWindowNode | null = null;

        // Search in the left child
        foundNode = findNodeFromWindowHandle(splitNode.leftChild, targetWindowHandle);
        if (foundNode) {
            return foundNode; // Found in left subtree
        }

        // If not found in left, search in the right child
        foundNode = findNodeFromWindowHandle(splitNode.rightChild, targetWindowHandle);
        if (foundNode) {
            return foundNode; // Found in right subtree
        }
    }

    // If no matching window handle was found in this subtree
    return null;
}

/**
 * Prints the structure of the BSP tree to the console, showing nodes and their relationships.
 * Performs a pre-order traversal.
 * @param node The current node to print.
 * @param indent The current indentation level (for visual hierarchy).
 */
export function printBspTree(logger: ConsoleLike, node: BspNode, indent: string = ''): void {
    if (!node) {
        return;
    }

    if (node.type === 'window') {
        logger.log(`${indent}Window Node (Title: ${node.windowHandle.title}) - Geo: (${node.geometry.x},${node.geometry.y},${node.geometry.width},${node.geometry.height})`);
    } else {
        const splitNode = node as ISplitNode;
        logger.log(`${indent}Split Node (Direction: ${splitNode.splitDirection}, Ratio: ${splitNode.splitRatio}) - Geo: (${node.geometry.x},${node.geometry.y},${node.geometry.width},${node.geometry.height})`);
        printBspTree(logger, splitNode.leftChild, indent + '  ├── ');
        printBspTree(logger, splitNode.rightChild, indent + '  └── ');
    }
}