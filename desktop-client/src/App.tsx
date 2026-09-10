import { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
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
import { isElectron } from './lib/runtime';

const defaultSettings = { storeName: 'ORANGE POS', currency: 'IQD' };

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled renderer error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-orange-light" dir="rtl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <h1 className="text-xl font-bold text-red-600">تعذر عرض التطبيق</h1>
            <p className="text-gray-600">حدث خطأ غير متوقع أثناء تشغيل الواجهة.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-orange text-white rounded-lg px-4 py-2 font-semibold"
            >
              إعادة تحميل الشاشة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [publicSettings, setPublicSettings] = useState(defaultSettings);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const publicResponse = await fetch(`${API_BASE_URL}/store-settings/public`);
        if (publicResponse.ok) {
          const data = await publicResponse.json();
          setPublicSettings({
            storeName: typeof data.storeName === 'string' ? data.storeName : defaultSettings.storeName,
            currency: typeof data.currency === 'string' ? data.currency : defaultSettings.currency,
          });
        } else {
          setPublicSettings(defaultSettings);
        }
        const response = await fetch(`${API_BASE_URL}/check-setup`);
        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }
        const data = await response.json();

        // التحقق مما إذا كان النظام يحتاج إعداداً بأي طريقة من قيم الاستجابة
        const isSetupNeeded = data.needsSetup ?? (data.isConfigured !== undefined ? !data.isConfigured : false);
        setNeedsSetup(Boolean(isSetupNeeded));
      } catch (error) {
        console.error('خطأ في الاتصال بالـ Backend:', error);
        setPublicSettings(defaultSettings);
        setNeedsSetup(false);
      }
    };

    checkSetupStatus();
  }, []);

  if (needsSetup === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', direction: 'rtl', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>جاري التحقق من إعدادات {publicSettings.storeName}...</h3>
        </div>
      </div>
    );
  }

  if (needsSetup && isElectron) {
    return <SetupPage onSetupComplete={() => { setNeedsSetup(false); navigate('/login'); }} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/setup"
        element={
          isElectron ? (
            <SetupPage onSetupComplete={() => { setNeedsSetup(false); navigate('/login'); }} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
      />

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

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}