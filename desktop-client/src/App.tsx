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

export default function App() {
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
