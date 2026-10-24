// 32-bit FNV-1a over the canonical serialization of the state (TECH_SPEC §3).

export const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Feeds one byte (0..255). */
export function hashByte(h: number, byte: number): number {
  return Math.imul(h ^ (byte & 0xff), FNV_PRIME) >>> 0;
}

/** Feeds a 32-bit integer as 4 little-endian bytes. Values must be integers. */
export function hashInt(h: number, v: number): number {
  let x = hashByte(h, v);
  x = hashByte(x, v >>> 8);
  x = hashByte(x, v >>> 16);
  return hashByte(x, v >>> 24);
}

export function hashInts(h: number, values: ArrayLike<number>): number {
  let x = h;
  for (let i = 0; i < values.length; i++) x = hashInt(x, values[i] ?? 0);
  return x;
}

export function hashBytes(h: number, bytes: ArrayLike<number>): number {
  let x = h;
  for (let i = 0; i < bytes.length; i++) x = hashByte(x, bytes[i] ?? 0);
  return x;
}

/** Hash of a UTF-16 string, code unit by code unit (ids, weapon keys). */
export function hashString(h: number, s: string): number {
  let x = hashInt(h, s.length);
  for (let i = 0; i < s.length; i++) x = hashInt(x, s.charCodeAt(i));
  return x;
}
