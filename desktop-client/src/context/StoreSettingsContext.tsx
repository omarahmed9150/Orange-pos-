import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/api';

interface PublicStoreSettings {
  storeName: string;
  currency: string;
}

const defaultSettings: PublicStoreSettings = {
  storeName: 'ORANGE POS',
  currency: 'IQD',
};

const StoreSettingsContext = createContext<PublicStoreSettings>(defaultSettings);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    fetch(`${API_BASE_URL}/store-settings/public`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Public settings request failed: ${response.status}`);
        const data = await response.json();
        setSettings({
          storeName: typeof data.storeName === 'string' && data.storeName.trim()
            ? data.storeName.trim()
            : defaultSettings.storeName,
          currency: typeof data.currency === 'string' && data.currency.trim()
            ? data.currency
            : defaultSettings.currency,
        });
      })
      .catch((error: unknown) => {
        console.error('تعذر تحميل إعدادات المتجر العامة:', error);
        setSettings(defaultSettings);
      });
  }, []);

  return <StoreSettingsContext.Provider value={settings}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings() {
  return useContext(StoreSettingsContext);
}
