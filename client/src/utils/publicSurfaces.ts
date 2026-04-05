export type PublicSurfaceName = 'dash' | 'roadmap';
export type PublicSurfaceMode = 'live' | 'placeholder';

const DEFAULT_PUBLIC_SURFACES_TARGET = 'https://2026gpt.jardenberg.se';

function normalizeMode(value?: string | null): PublicSurfaceMode {
  return value === 'placeholder' ? 'placeholder' : 'live';
}

function normalizeTarget(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : DEFAULT_PUBLIC_SURFACES_TARGET;
}

export function getPublicSurfaceConfig(surface: PublicSurfaceName) {
  const targetBase = normalizeTarget(import.meta.env.VITE_PUBLIC_SURFACES_TARGET);
  const rawMode =
    surface === 'dash' ? import.meta.env.VITE_PUBLIC_DASH_MODE : import.meta.env.VITE_PUBLIC_ROADMAP_MODE;

  return {
    mode: normalizeMode(rawMode),
    targetBase,
    targetUrl: `${targetBase}/${surface}`,
  };
}
