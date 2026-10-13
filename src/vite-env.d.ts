/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly APP_HOME_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface DesktopSource {
  id: string;
  name: string;
  display_id: string;
  thumbnail: { dataUrl: string };
  appIcon: string | null;
}

interface ElectronAPI {
  showNotification?: (payload: {
    title: string;
    body: string;
    icon?: string;
    silent?: boolean;
    roomUrl?: string;
  }) => Promise<boolean>;
  onOpenRoom?: (cb: (url: string) => void) => void;
  getPendingRoom?: () => Promise<string | null>;
  getAppVersion?: () => Promise<string>;
  getDesktopSources?: (options: {
    types: string[];
    thumbnailSize?: { width: number; height: number };
  }) => Promise<DesktopSource[]>;
  onOpenDesktopPicker?: (cb: () => void) => void;
  selectDesktopSource?: (source: Record<string, unknown> | null) => void;
  onUpdateDownloaded?: (cb: () => void) => void;
  installUpdate?: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
