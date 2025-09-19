import type Meta from "gi://Meta";
import { type IGeometry, isPointInGeometry } from "./geometry.js";

/**
 * Defines the possible directions for a split in the binary tree.
 * - 'horizontal': Divides a region into top and bottom sub-regions.
 * - 'vertical': Divides a region into left and right sub-regions.
 */
type SplitDirection = "horizontal" | "vertical";

/**
 * Represents a node in the Binary Space Partitioning (BSP) tree.
 * This is a base interface that both SplitNode and WindowNode will extend.
 */
interface IBspNode {
  type: "split" | "window"; // Discriminator to easily determine node type
  parent: BspNode | null; // Reference to the parent node, null for the root
  geometry: IGeometry; // The calculated screen area this node occupies
}

/**
 * Represents an internal node in the BSP tree.
 * A SplitNode divides its 'geometry' into two sub-regions.
 */
export interface ISplitNode extends IBspNode {
  type: "split";
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
  type: "window";
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
export function createWindowNode(
  windowHandle: Meta.Window,
  geometry: IGeometry,
  parent: BspNode | null = null,
): IWindowNode {
  return {
    type: "window",
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
  parent: BspNode | null = null,
): ISplitNode {
  const splitNode: ISplitNode = {
    type: "split",
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
 * Prints the structure of the BSP tree to the console, showing nodes and their relationships.
 * Performs a pre-order traversal.
 * @param node The current node to print.
 * @param indent The current indentation level (for visual hierarchy).
 */
export function printLayout(node: BspNode, indent: string = ""): void {
  if (!node) {
    return;
  }

  if (node.type === "window") {
    console.debug(
      `${indent}Window Node (Title: ${node.windowHandle.title} ${node.windowHandle.get_pid()}) - Geo: (${node.geometry.x},${node.geometry.y},${node.geometry.width},${node.geometry.height})`,
    );
  } else {
    const splitNode = node as ISplitNode;
    console.debug(
      `${indent}Split Node (Direction: ${splitNode.splitDirection}, Ratio: ${splitNode.splitRatio}) - Geo: (${node.geometry.x},${node.geometry.y},${node.geometry.width},${node.geometry.height})`,
    );
    printLayout(splitNode.leftChild, `${indent}  ├── `);
    printLayout(splitNode.rightChild, `${indent}  └── `);
  }
}

export function adjustSplitRatio(
  node: BspNode,
  parent: ISplitNode,
  newGeometry: IGeometry,
  minSplitRatio: number,
): void {
  if (parent.splitDirection === "vertical") {
    if (parent.leftChild === node) {
      parent.splitRatio = newGeometry.width / parent.geometry.width;
    } else {
      parent.splitRatio =
        (parent.geometry.width - newGeometry.width) / parent.geometry.width;
    }
  } else {
    if (parent.leftChild === node) {
      parent.splitRatio = newGeometry.height / parent.geometry.height;
    } else {
      parent.splitRatio =
        (parent.geometry.height - newGeometry.height) / parent.geometry.height;
    }
  }

  if (
    parent.splitRatio > 1 - minSplitRatio ||
    parent.splitRatio < minSplitRatio
  ) {
    console.debug(
      `Split ratio ${parent.splitRatio} is out of bounds, clamping ratio.`,
    );
    parent.splitRatio = Math.clamp(
      parent.splitRatio,
      minSplitRatio,
      1 - minSplitRatio,
    );
  }
}

export function windowAtPointer(
  rootNode: BspNode,
  cursorX: number,
  cursorY: number,
): IWindowNode | null {
  // If the cursor is not within the root node's geometry, no window can be found
  if (!isPointInGeometry(cursorX, cursorY, rootNode.geometry)) {
    return null;
  }

  if (rootNode.type === "window") {
    // If it's a window node, and the cursor is within its geometry, return it
    return rootNode;
  } else {
    // If it's a split node, determine which child the cursor is in and recurse
    const splitNode = rootNode; // Cast for type safety

    const { x, y, width, height } = splitNode.geometry;
    const { splitDirection, splitRatio, leftChild, rightChild } = splitNode;

    if (splitDirection === "vertical") {
      // Vertical split: left and right children
      const splitX = x + width * splitRatio;
      if (cursorX < splitX) {
        return windowAtPointer(leftChild, cursorX, cursorY);
      } else {
        return windowAtPointer(rightChild, cursorX, cursorY);
      }
    } else {
      // Horizontal split: top and bottom children
      const splitY = y + height * splitRatio;
      if (cursorY < splitY) {
        return windowAtPointer(leftChild, cursorX, cursorY);
      } else {
        return windowAtPointer(rightChild, cursorX, cursorY);
      }
    }
  }
}
