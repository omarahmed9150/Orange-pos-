import { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '../lib/api';

interface Summary {
  revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; salesCount: number;
}
interface TopProduct { name: string; qty: number; revenue: number }
interface SlowProduct { name: string; stockQuantity: number }
interface Employee { name: string; invoiceCount: number; totalSales: number }

export function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [slowProducts, setSlowProducts] = useState<SlowProduct[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  async function load() {
    const params = { from: from || undefined, to: to || undefined };
    const [s, t, sl, e] = await Promise.all([
      api.get('/reports/financial-summary', { params }),
      api.get('/reports/top-products', { params }),
      api.get('/reports/slow-products', { params }),
      api.get('/reports/employee-performance', { params }),
    ]);
    setSummary(s.data);
    setTopProducts(t.data);
    setSlowProducts(sl.data);
    setEmployees(e.data);
  }

  useEffect(() => {
    load();
  }, []);

  function exportExcel() {
    const params = new URLSearchParams({ from: from || '', to: to || '' });
    const token = localStorage.getItem('orange_token');
    const url = `${API_BASE_URL}/reports/export/excel?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'ORANGE_Report.xlsx';
        link.click();
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold">التقارير والتحليلات</h1>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-xs mb-1">من</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs mb-1">إلى</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <button onClick={load} className="bg-gray-800 text-white rounded-lg px-4 py-1.5 text-sm">تطبيق</button>
          <button onClick={exportExcel} className="bg-emerald-600 text-white rounded-lg px-4 py-1.5 text-sm">📊 تصدير Excel</button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard label="الإيرادات" value={summary.revenue} color="bg-blue-500" />
          <SummaryCard label="تكلفة البضاعة" value={summary.cogs} color="bg-gray-500" />
          <SummaryCard label="إجمالي الربح" value={summary.grossProfit} color="bg-emerald-600" />
          <SummaryCard label="المصاريف" value={summary.expenses} color="bg-red-500" />
          <SummaryCard label="صافي الربح" value={summary.netProfit} color="bg-orange" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-3">🏆 الأكثر مبيعاً</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 border-b text-right"><th className="py-1">الصنف</th><th>الكمية</th><th>الإيراد</th></tr></thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} className="border-b last:border-0"><td className="py-1">{p.name}</td><td>{p.qty}</td><td>{p.revenue.toFixed(2)}</td></tr>
              ))}
              {!topProducts.length && <tr><td colSpan={3} className="text-center text-gray-400 py-4">لا توجد بيانات</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-3">🐢 الأصناف الراكدة</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 border-b text-right"><th className="py-1">الصنف</th><th>المخزون</th></tr></thead>
            <tbody>
              {slowProducts.map((p, i) => (
                <tr key={i} className="border-b last:border-0"><td className="py-1">{p.name}</td><td>{p.stockQuantity}</td></tr>
              ))}
              {!slowProducts.length && <tr><td colSpan={2} className="text-center text-gray-400 py-4">لا يوجد أصناف راكدة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-bold mb-3">👤 أداء الموظفين</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 border-b text-right"><th className="py-1">الموظف</th><th>عدد الفواتير</th><th>إجمالي المبيعات</th></tr></thead>
          <tbody>
            {employees.map((e, i) => (
              <tr key={i} className="border-b last:border-0"><td className="py-1">{e.name}</td><td>{e.invoiceCount}</td><td>{e.totalSales.toFixed(2)}</td></tr>
            ))}
            {!employees.length && <tr><td colSpan={3} className="text-center text-gray-400 py-4">لا توجد بيانات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} text-white rounded-2xl shadow p-4`}>
      <p className="text-xs opacity-90">{label}</p>
      <p className="text-xl font-bold mt-1">{value.toFixed(2)}</p>
    </div>
  );
}
