/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOGGER: string;
  readonly VITE_LOGGER_FILTER: string;
  readonly VITE_PUBLIC_DASH_MODE: string;
  readonly VITE_PUBLIC_ROADMAP_MODE: string;
  readonly VITE_PUBLIC_SURFACES_TARGET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
