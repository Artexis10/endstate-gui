import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getColorClasses, type SemanticColor } from './apply-utils';

/**
 * Status text on result, preview and restore rows must read at WCAG AA
 * (4.5:1) in the light theme, and the dark theme must not lose contrast.
 * The colours come from the theme tokens in globals.css, so this reads them
 * there instead of trusting a copy.
 */

// Vitest stubs CSS imports, so the stylesheet is read from disk.
const globalsCss = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

type Rgb = [number, number, number];

/** The `--name: H S% L%` declarations of one top-level CSS block. */
function themeTokens(selector: ':root' | '.light'): Record<string, string> {
  const start = globalsCss.indexOf(`${selector} {`);
  expect(start, `${selector} block in globals.css`).toBeGreaterThanOrEqual(0);
  const block = globalsCss.slice(start, globalsCss.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
  return tokens;
}

function hslToRgb(value: string): Rgb {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [channel(0), channel(8), channel(4)];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A status chip's 10% fill of its own colour over a surface. */
function tint(color: Rgb, surface: Rgb): Rgb {
  return color.map((v, i) => v * 0.1 + surface[i] * 0.9) as Rgb;
}

/** The theme token a status colour's text class reads, e.g. `text-status-danger` → `status-danger`. */
function textToken(color: SemanticColor): string {
  const text = getColorClasses(color).text;
  const match = /^text-((?:status-[a-z]+)|muted-foreground)$/.exec(text);
  expect(match, `${color} text class "${text}" must use a theme token`).not.toBeNull();
  return match![1];
}

const STATUS_COLORS: SemanticColor[] = ['success', 'warn', 'error', 'info', 'action', 'detected'];

/**
 * Dark-theme ratios on the dark background before this change (Tailwind
 * blue-400/blue-500/teal-600 and the semantic tokens). Dark must not drop.
 */
const DARK_BASELINE: Record<SemanticColor, number> = {
  success: 8.33,
  warn: 8.95,
  error: 5.06,
  info: 7.53,
  action: 5.2,
  detected: 5.11,
  muted: 6.07,
};

const AA = 4.5;

describe('status text contrast', () => {
  const light = themeTokens('.light');
  const dark = themeTokens(':root');

  it.each(STATUS_COLORS)('%s reads at AA in the light theme on every row surface and its chip tint', (color) => {
    const fg = hslToRgb(light[textToken(color)]);
    const surfaces: Record<string, Rgb> = {
      background: hslToRgb(light.background),
      panel: hslToRgb(light.panel),
      muted: hslToRgb(light.muted),
    };
    surfaces['chip tint on background'] = tint(fg, surfaces.background);
    surfaces['chip tint on panel'] = tint(fg, surfaces.panel);
    for (const [name, surface] of Object.entries(surfaces)) {
      expect(contrast(fg, surface), `${color} on ${name}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('muted status text (PRESENT, UP TO DATE) reads at AA on the light row surfaces', () => {
    const fg = hslToRgb(light[textToken('muted')]);
    expect(contrast(fg, hslToRgb(light.background))).toBeGreaterThanOrEqual(AA);
    expect(contrast(fg, hslToRgb(light.panel))).toBeGreaterThanOrEqual(AA);
  });

  it.each([...STATUS_COLORS, 'muted' as SemanticColor])('%s keeps at least its previous dark-theme contrast', (color) => {
    const ratio = contrast(hslToRgb(dark[textToken(color)]), hslToRgb(dark.background));
    expect(ratio).toBeGreaterThanOrEqual(DARK_BASELINE[color] - 0.01);
  });
});
