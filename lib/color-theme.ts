function normalizeHex(hex: string) {
  const value = hex.trim().replace("#", "");
  if (value.length === 3) {
    return `#${value
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }

  return `#${value}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);
  const value = normalized.slice(1);

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function channelToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function clamp(value: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

export function mixHex(base: string, target: string, targetWeight: number) {
  const safeWeight = Math.min(1, Math.max(0, targetWeight));
  const from = hexToRgb(base);
  const to = hexToRgb(target);

  const r = Math.round(from.r * (1 - safeWeight) + to.r * safeWeight);
  const g = Math.round(from.g * (1 - safeWeight) + to.g * safeWeight);
  const b = Math.round(from.b * (1 - safeWeight) + to.b * safeWeight);

  return `#${[r, g, b]
    .map((channel) => clamp(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function toRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getReadableTextColor(
  background: string,
  dark = "#0f172a",
  light = "#ffffff"
) {
  return luminance(background) > 0.45 ? dark : light;
}
