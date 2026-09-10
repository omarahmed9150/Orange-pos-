declare global {
  interface Window {
    process?: {
      versions?: {
        electron?: string;
      };
    };
  }
}

export const isElectron =
  typeof window !== 'undefined' &&
  (window.process?.versions?.electron !== undefined ||
    navigator.userAgent.toLowerCase().includes('electron'));

