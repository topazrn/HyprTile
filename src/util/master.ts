import type Meta from "gi://Meta";
import type { IGeometry } from "./geometry.js";

export interface IWindowNode {
  windowHandle: Meta.Window;
  splitRatio: number;
}

export interface IRootNode {
  masterIndex: number;
  windows: IWindowNode[];
}

export function adjustSplitRatio(
  root: IRootNode,
  node: IWindowNode,
  newGeometry: IGeometry,
  workArea: IGeometry,
  minSplitRatio: number,
): void {
  if (root.windows.length === 0) return;
  const masterNode = root.windows[root.masterIndex];

  if (root.windows.length === 1) {
    masterNode.splitRatio = 1;
    return;
  }

  if (node === masterNode) {
    masterNode.splitRatio = newGeometry.width / workArea.width;
    return;
  }

  if (root.windows.length === 2) {
    masterNode.splitRatio = 1 - newGeometry.width / workArea.width;
    node.splitRatio = 1;
    return;
  }

  masterNode.splitRatio = 1 - newGeometry.width / workArea.width;
  node.splitRatio = newGeometry.height / workArea.height;
  const rest = 1 - node.splitRatio;
  const nodeIndex = root.windows.indexOf(node);

  let calculatedCount = 0;
  for (let index = 0; calculatedCount < root.windows.length - 3; index++) {
    if (index === root.masterIndex) continue;
    if (index === nodeIndex) continue;

    const window = root.windows[index];
    window.splitRatio = Math.max(window.splitRatio * rest, minSplitRatio);
    calculatedCount++;
  }

  // const sum = root.windows
  //   .map((w) => (w === masterNode ? 0 : w.splitRatio))
  //   .reduce((a, b) => a + b);
}
