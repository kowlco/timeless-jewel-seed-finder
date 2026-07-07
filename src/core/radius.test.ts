import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nodesInRadius, type TreeData } from './radius';

const version = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/current.json'), 'utf8'),
).treeVersion as string;
const tree = JSON.parse(
  readFileSync(resolve(__dirname, `../../data/${version}/tree.json`), 'utf8'),
) as TreeData;
const sample = JSON.parse(
  readFileSync(resolve(__dirname, '../../fixtures/radius-socket-26725.json'), 'utf8'),
) as { socketId: number; radius: number; nodeIds: number[] };

describe('nodesInRadius', () => {
  it('matches the reference-geometry affected node set for a known socket', () => {
    const got = nodesInRadius(sample.socketId, tree).sort((a, b) => a - b);
    expect(got).toEqual([...sample.nodeIds].sort((a, b) => a - b));
  });

  it('includes the socket itself and a plausible node count', () => {
    const got = nodesInRadius(sample.socketId, tree);
    expect(got).toContain(sample.socketId); // distance 0 < radius
    expect(got.length).toBeGreaterThan(20);
    expect(got.length).toBeLessThan(200);
  });

  it('returns empty for an unknown socket', () => {
    expect(nodesInRadius(999999999, tree)).toEqual([]);
  });
});
