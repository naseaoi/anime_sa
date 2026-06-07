export const DEFAULT_THEME_COLOR = '#c78c2b';

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

export const isValidThemeColor = (value: string): boolean => HEX_PATTERN.test(value.trim());

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const hexToRgb = (hex: string): [number, number, number] => {
  const match = hex.trim().match(HEX_PATTERN);
  const normalized = match ? match[1] : DEFAULT_THEME_COLOR.slice(1);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  ];
};

const lighten = (rgb: [number, number, number], ratio: number): [number, number, number] => {
  const [r, g, b] = rgb;
  return [clamp(r + (255 - r) * ratio), clamp(g + (255 - g) * ratio), clamp(b + (255 - b) * ratio)];
};

const toRgbString = ([r, g, b]: [number, number, number]) => `${r}, ${g}, ${b}`;

const toHex = ([r, g, b]: [number, number, number]) =>
  '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

export const applyThemeColor = (color: string | undefined): void => {
  const base = color && isValidThemeColor(color) ? color : DEFAULT_THEME_COLOR;
  const lightRgb = hexToRgb(base);
  const darkRgb = lighten(lightRgb, 0.28);
  const root = document.documentElement;

  root.style.setProperty('--accent-light', base);
  root.style.setProperty('--accent-soft-light', `rgba(${toRgbString(lightRgb)}, 0.16)`);
  root.style.setProperty('--accent-dark', toHex(darkRgb));
  root.style.setProperty('--accent-soft-dark', `rgba(${toRgbString(darkRgb)}, 0.18)`);
};
