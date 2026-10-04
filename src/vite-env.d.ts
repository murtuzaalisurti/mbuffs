/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: force the visitor region (e.g. "IN") instead of detecting it. */
  readonly VITE_DEV_REGION?: string;
}

declare module '@fontsource-variable/google-sans-flex';
declare module '@fontsource-variable/plus-jakarta-sans';
declare module '@fontsource-variable/fraunces';
