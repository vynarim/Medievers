import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs Vitest in Node', () => {
    expect(typeof process.versions.node).toBe('string');
  });
});
