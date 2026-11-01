/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly APP_HOME_URL: string;
  readonly VITE_GIPHY_API_KEY?: string;
  readonly VITE_KLIPY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
