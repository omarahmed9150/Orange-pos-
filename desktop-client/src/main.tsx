import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { ProductCacheProvider } from './context/ProductCacheContext';
import { LicenseGate } from './components/LicenseGate';
import { clearStorageIfTokenHasInvalidStore } from './lib/auth-storage';
import { StoreSettingsProvider } from './context/StoreSettingsContext';
import './index.css';

clearStorageIfTokenHasInvalidStore();

if (import.meta.env.PROD && (window.location.protocol === 'http:' || window.location.protocol === 'https:') && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LicenseGate>
      <HashRouter>
        <I18nProvider>
          <AuthProvider>
            <StoreSettingsProvider>
              <ProductCacheProvider>
                <App />
              </ProductCacheProvider>
            </StoreSettingsProvider>
          </AuthProvider>
        </I18nProvider>
      </HashRouter>
    </LicenseGate>
  </React.StrictMode>,
);
