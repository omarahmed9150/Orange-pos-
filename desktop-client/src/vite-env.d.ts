/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STORE_NAME: string;
  readonly VITE_STORE_ADDRESS: string;
  readonly VITE_TAX_RATE: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electron: {
    ipcRenderer: {
      send: (channel: string) => void;
      on: (channel: string, callback: () => void) => () => void;
    };
  };
}
