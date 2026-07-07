// Passive-tree geometry + timeless-jewel radius membership.
// Ported verbatim from reference frontend skill_tree.ts (orbit angle tables,
// calculateNodePos, rotateAroundPoint, baseJewelRadius). The min_x/min_y canvas
// translation is a shared offset that cancels in distance, so we omit it.

export const LARGE_RADIUS = 1800; // baseJewelRadius (reference frontend)

export const orbit16Angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export const orbit40Angles = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190,
  200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350,
];

export interface Point {
  x: number;
  y: number;
}
export interface TreeNode {
  skill?: number;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
}
export interface TreeData {
  constants: { orbitRadii: number[]; skillsPerOrbit: number[] };
  groups: Record<string, { x: number; y: number }>;
  nodes: Record<string, TreeNode>;
  jewelSlots: number[];
}

export function orbitAngleAt(orbit: number, index: number, skillsPerOrbit: number[]): number {
  const n = skillsPerOrbit[orbit];
  if (n === 16) return orbit16Angles[orbit16Angles.length - index] || 0;
  if (n === 40) return orbit40Angles[orbit40Angles.length - index] || 0;
  return 360 - (360 / n) * index;
}

function rotate(center: Point, target: Point, angleDeg: number): Point {
  const rad = (Math.PI / 180) * angleDeg;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cos * (target.x - center.x) + sin * (target.y - center.y) + center.x,
    y: cos * (target.y - center.y) - sin * (target.x - center.x) + center.y,
  };
}

export function nodeWorldPos(node: TreeNode, tree: TreeData): Point {
  if (node.group === undefined || node.orbit === undefined || node.orbitIndex === undefined) {
    return { x: 0, y: 0 };
  }
  const g = tree.groups[node.group];
  const angle = orbitAngleAt(node.orbit, node.orbitIndex, tree.constants.skillsPerOrbit);
  const groupPos = { x: g.x, y: g.y };
  const above = { x: g.x, y: g.y - tree.constants.orbitRadii[node.orbit] };
  return rotate(groupPos, above, angle);
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function isPositioned(n: TreeNode): boolean {
  return n.group !== undefined && n.orbit !== undefined && n.orbitIndex !== undefined;
}

// Node ids of all positioned tree nodes within the timeless radius of the socket.
export function nodesInRadius(socketId: number, tree: TreeData): number[] {
  const socket = tree.nodes[String(socketId)];
  if (!socket || !isPositioned(socket)) return [];
  const socketPos = nodeWorldPos(socket, tree);
  const out: number[] = [];
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (!isPositioned(node)) continue;
    if (distance(nodeWorldPos(node, tree), socketPos) < LARGE_RADIUS) out.push(Number(id));
  }
  return out;
}
