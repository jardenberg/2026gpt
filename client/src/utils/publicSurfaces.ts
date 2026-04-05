export type PublicSurfaceName = 'dash' | 'roadmap';
export type PublicSurfaceMode = 'live' | 'placeholder';

export type PublicSurfacesConfig = {
  dashMode: PublicSurfaceMode;
  roadmapMode: PublicSurfaceMode;
  targetBase: string;
};

const DEFAULT_PUBLIC_SURFACES_TARGET = 'https://2026gpt.jardenberg.se';

export function getDefaultPublicSurfacesConfig(): PublicSurfacesConfig {
  return {
    dashMode: 'live',
    roadmapMode: 'live',
    targetBase: DEFAULT_PUBLIC_SURFACES_TARGET,
  };
}

export async function fetchPublicSurfacesConfig(): Promise<PublicSurfacesConfig> {
  const response = await fetch('/api/public/surface-config', {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load public surface configuration');
  }

  return response.json();
}

export function getPublicSurfaceConfig(
  surface: PublicSurfaceName,
  config: PublicSurfacesConfig,
) {
  const mode = surface === 'dash' ? config.dashMode : config.roadmapMode;
  const targetBase = config.targetBase.replace(/\/+$/, '');

  return {
    mode,
    targetBase,
    targetUrl: `${targetBase}/${surface}`,
  };
}
