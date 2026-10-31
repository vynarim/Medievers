import { describe, expect, it } from 'vitest';
import {
  UI_SCALE_MIN,
  isPhonePortrait,
  isShortLandscape, scalableCss,
  uiScale,
} from '../../src/ui/ui-scale.ts';

describe('uiScale', () => {
  it('keeps full size on the 1920×1080 reference screen', () => {
    expect(uiScale(1920, 1080)).toBe(1);
  });
  it('shrinks with the shorter side of a small window', () => {
    expect(uiScale(1280, 620)).toBe(0.62);
    expect(uiScale(1180, 820)).toBe(0.74);
  });
  it('keeps a touch tablet held sideways at full size', () => {
    expect(uiScale(1280, 800, true)).toBe(1);
    expect(uiScale(1280, 800)).toBe(0.8);
    expect(uiScale(1024, 700, true)).toBe(0.8);
  });
  it('takes a short landscape screen for a tablet, not a phone upright', () => {
    expect(isShortLandscape(1280, 800)).toBe(true);
    expect(isShortLandscape(1920, 1080)).toBe(false);
    expect(isShortLandscape(390, 844)).toBe(false);
  });
  it('never goes below the legibility floor', () => {
    expect(uiScale(640, 360)).toBe(UI_SCALE_MIN);
  });
  it('sizes a phone held upright by its width alone', () => {
    expect(isPhonePortrait(390, 844)).toBe(true);
    expect(isPhonePortrait(844, 390)).toBe(false);
    expect(isPhonePortrait(820, 1180)).toBe(false);
    expect(uiScale(390, 844)).toBe(0.75);
    expect(uiScale(320, 568)).toBe(0.62);
  });
});

describe('scalableCss', () => {
  it('scales lengths but keeps hairlines', () => {
    expect(scalableCss('border: 2px solid; top: 12px; width: calc(100vw - 24px);')).toBe(
      'border: 2px solid; top: calc(12 * var(--u)); width: calc(100vw - calc(24 * var(--u)));',
    );
  });
});
