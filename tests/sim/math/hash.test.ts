import { describe, expect, it } from 'vitest';
import { FNV_OFFSET, hashBytes, hashInt, hashInts, hashString } from '../../../src/sim/math';

const ascii = (s: string): number[] => Array.from(s, (ch) => ch.charCodeAt(0));

describe('FNV-1a 32', () => {
  it('matches the published test vectors', () => {
    expect(hashBytes(FNV_OFFSET, ascii(''))).toBe(0x811c9dc5);
    expect(hashBytes(FNV_OFFSET, ascii('a'))).toBe(0xe40c292c);
    expect(hashBytes(FNV_OFFSET, ascii('foobar'))).toBe(0xbf9cf968);
  });

  it('hashes integers as little-endian bytes, negatives in two complement', () => {
    expect(hashInt(FNV_OFFSET, 0x64636261)).toBe(hashBytes(FNV_OFFSET, ascii('abcd')));
    expect(hashInt(FNV_OFFSET, -1)).toBe(hashBytes(FNV_OFFSET, [255, 255, 255, 255]));
    expect(hashInts(FNV_OFFSET, [1, 2])).toBe(hashInt(hashInt(FNV_OFFSET, 1), 2));
  });

  it('separates strings by length and content', () => {
    expect(hashString(FNV_OFFSET, 'ab')).not.toBe(hashString(FNV_OFFSET, 'ba'));
    expect(hashString(FNV_OFFSET, '')).not.toBe(FNV_OFFSET);
  });
});
