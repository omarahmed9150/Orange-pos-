import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  printReceipt: (htmlContent: string) => Promise<{ success: boolean }>;
  openCashDrawer: () => Promise<{ success: boolean; message: string }>;
  checkLicense: () => Promise<{ activated: boolean; key?: string }>;
  activateLicense: (key: string) => Promise<{ success: boolean; message: string }>;
  onUpdateAvailable: (callback: (info: { version: string }) => void) => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
  restartAndInstallUpdate: () => Promise<void>;
  notifyProductsChanged: () => void;
  onProductsChanged: (callback: () => void) => void;
}

const electronAPI: ElectronAPI = {
  printReceipt: (htmlContent: string) =>
    ipcRenderer.invoke('print-receipt', htmlContent),
  openCashDrawer: () => ipcRenderer.invoke('open-cash-drawer'),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (key: string) => ipcRenderer.invoke('activate-license', key),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install-update'),
  notifyProductsChanged: () => ipcRenderer.send('product-updated'),
  onProductsChanged: (callback) => {
    ipcRenderer.on('products-changed', () => callback());
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string) => {
      if (channel === 'product-updated') ipcRenderer.send(channel);
    },
    on: (channel: string, callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});
