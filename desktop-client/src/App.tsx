import { useState, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { SalesHistory } from './pages/SalesHistory';
import { Shifts } from './pages/Shifts';
import { Products } from './pages/Products';
import { Expenses } from './pages/Expenses';
import { Settings } from './pages/Settings';
import { Suppliers } from './pages/Suppliers';
import { Customers } from './pages/Customers';
import { Purchases } from './pages/Purchases';
import { Inventory } from './pages/Inventory';
import { BarcodeLabels } from './pages/BarcodeLabels';
import { Reports } from './pages/Reports';
import { AuditLog } from './pages/AuditLog';
import { ReceiptDesigner } from './pages/ReceiptDesigner';
import { Users } from './pages/Users';
import { SetupPage } from './pages/SetupPage';
import { API_BASE_URL } from './lib/api';

export default function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupCheckError, setSetupCheckError] = useState<string | null>(null);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/check-setup`);
        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }
        const data = await response.json();

        // التحقق مما إذا كان النظام يحتاج إعداداً بأي طريقة من قيم الاستجابة
        const isSetupNeeded = data.needsSetup ?? (data.isConfigured !== undefined ? !data.isConfigured : false);
        setSetupCheckError(null);
        setNeedsSetup(Boolean(isSetupNeeded));
      } catch (error) {
        console.error('خطأ في الاتصال بالـ Backend:', error);
        setSetupCheckError('تعذر الاتصال بخادم النظام للتحقق من الإعدادات.');
      }
    };

    checkSetupStatus();
  }, []);

  if (needsSetup === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', direction: 'rtl', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>{setupCheckError ?? 'جاري التحقق من إعدادات النظام...'}</h3>
          {setupCheckError && <p>يرجى التأكد من اتصال الخادم ثم إعادة تحميل الصفحة.</p>}
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupPage onSetupComplete={() => setNeedsSetup(false)} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/sales" element={<SalesHistory />} />
          <Route path="/shifts" element={<Shifts />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/settings" element={<Settings />} />

          <Route element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']} />}>
            <Route path="/products" element={<Products />} />
            <Route path="/receipt-designer" element={<ReceiptDesigner />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/barcode-labels" element={<BarcodeLabels />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']} />}>
            <Route path="/users" element={<Users />} />
            <Route path="/audit-log" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}