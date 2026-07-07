import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs typescript + vitest', () => {
    const x: number = 40 + 2;
    expect(x).toBe(42);
  });
});
