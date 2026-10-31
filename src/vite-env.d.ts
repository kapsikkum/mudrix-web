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

/**
 * Only the global push-to-talk bridge is still read from `window.electronAPI` (usePushToTalk,
 * Keybinds). Nothing in this repo defines it; a desktop shell may supply it.
 */
interface ElectronAPI {
  setPushToTalkKey?: (code: string | null) => Promise<'active' | 'no-permission' | 'unsupported'>;
  onPushToTalk?: (cb: (pressed: boolean) => void) => () => void;
  getPushToTalkPermission?: () => Promise<boolean>;
  requestPushToTalkPermission?: () => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
