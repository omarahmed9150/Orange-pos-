import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { LockScreen } from './LockScreen';
import { UpdateBanner } from './UpdateBanner';
import { APP_BUILD_DATE, APP_VERSION } from '../lib/version';
import { useStoreSettings } from '../context/StoreSettingsContext';

const navItems = [
  { to: '/', icon: '📊', key: 'dashboard', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/pos', icon: '🛒', key: 'pos', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/sales', icon: '🧾', key: 'sales', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/shifts', icon: '⏱️', key: 'shifts', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/products', icon: '📦', key: 'products', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/inventory', icon: '📋', key: 'inventory', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/reports', icon: '📈', key: 'reports', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/barcode-labels', icon: '🏷️', key: 'barcodeLabels', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/purchases', icon: '🧮', key: 'purchases', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/suppliers', icon: '🚚', key: 'suppliers', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/customers', icon: '👤', key: 'customers', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/receipt-designer', icon: '🧾', key: 'receiptDesigner', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { to: '/expenses', icon: '💸', key: 'expenses', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/settings', icon: '⚙️', key: 'settings', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/users', icon: '👥', key: 'users', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/audit-log', icon: '🕵️', key: 'auditLog', roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export function Layout() {
  const { user, logout, locked, lock } = useAuth();
  const { t } = useI18n();
  const { storeName } = useStoreSettings();

  return (
    <>
      {locked && <LockScreen />}
      <div className="flex flex-col h-screen">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
      <aside className="w-64 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold text-orange">{storeName}</h1>
          <p className="text-xs text-gray-500">نظام إدارة نقاط البيع</p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !user || item.roles.includes(user.role))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive ? 'bg-orange text-white' : 'text-gray-700 hover:bg-orange-light'
                  }`
                }
              >
                {item.icon} {t(item.key)}
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t">
          <p className="text-sm font-semibold">{user?.fullName}</p>
          <p className="text-xs text-gray-500 mb-2">{user?.role}</p>
          <div className="flex gap-2">
            <button
              onClick={lock}
              className="flex-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg py-1.5"
              title="قفل الشاشة (تبديل سريع بـ PIN)"
            >
              🔒 قفل
            </button>
            <button
              onClick={logout}
              className="flex-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg py-1.5"
            >
              {t('logout')}
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] text-gray-400" dir="ltr">
            Build v{APP_VERSION} - Fix Store | {APP_BUILD_DATE}
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
      </div>
    </div>
    </>
  );
}
