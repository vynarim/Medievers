import { describe, expect, it } from 'vitest';
import { UI_SCALE_MIN, scalableCss, uiScale } from '../../src/ui/ui-scale.ts';

describe('uiScale', () => {
  it('keeps full size on the 1920×1080 reference screen', () => {
    expect(uiScale(1920, 1080)).toBe(1);
  });
  it('shrinks with the shorter side of a small window', () => {
    expect(uiScale(1280, 620)).toBe(0.62);
    expect(uiScale(1180, 820)).toBe(0.74);
  });
  it('never goes below the legibility floor', () => {
    expect(uiScale(640, 360)).toBe(UI_SCALE_MIN);
  });
});

describe('scalableCss', () => {
  it('scales lengths but keeps hairlines', () => {
    expect(scalableCss('border: 2px solid; top: 12px; width: calc(100vw - 24px);')).toBe(
      'border: 2px solid; top: calc(12 * var(--u)); width: calc(100vw - calc(24 * var(--u)));',
    );
  });
});
