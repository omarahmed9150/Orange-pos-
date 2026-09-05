import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SalesTrendChart } from '../components/SalesTrendChart';

interface Sale {
  id: string;
  totalAmount: number;
  discount: number;
  createdAt: string;
  paymentMethod: string;
  refundStatus: 'NONE' | 'PARTIAL' | 'FULL';
  userId: string;
}

type FilterRange = 'day' | 'week' | 'month';

function startOfRange(range: FilterRange): Date {
  const now = new Date();
  if (range === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function Dashboard() {
  const { user } = useAuth();
  const [openShiftId, setOpenShiftId] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRange>('day');
  const [trend, setTrend] = useState<{ date: string; total: number }[]>([]);

  useEffect(() => {
    api.get('/reports/sales-trend', { params: { days: 7 } }).then(({ data }) => setTrend(data));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: shift } = await api.get('/shifts/open/me');
        setOpenShiftId(shift?.id ?? null);
        if (shift?.id) {
          const { data } = await api.get(`/sales/shift/${shift.id}`);
          setSales(data);
        } else {
          setSales([]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sums = useMemo(() => {
    const dayStart = startOfRange('day').getTime();
    const weekStart = startOfRange('week').getTime();
    const monthStart = startOfRange('month').getTime();

    const netAmount = (s: Sale) => (s.refundStatus === 'FULL' ? 0 : s.totalAmount);

    return {
      day: sales.filter((s) => new Date(s.createdAt).getTime() >= dayStart).reduce((sum, s) => sum + netAmount(s), 0),
      week: sales.filter((s) => new Date(s.createdAt).getTime() >= weekStart).reduce((sum, s) => sum + netAmount(s), 0),
      month: sales.filter((s) => new Date(s.createdAt).getTime() >= monthStart).reduce((sum, s) => sum + netAmount(s), 0),
    };
  }, [sales]);

  const filteredSales = useMemo(() => {
    const start = startOfRange(filter).getTime();
    return sales
      .filter((s) => new Date(s.createdAt).getTime() >= start)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مرحباً، {user?.fullName}</h1>
        <p className="text-gray-500 text-sm">نظرة سريعة على مبيعاتك</p>
      </div>

      {!openShiftId && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl p-4 text-sm">
          لا توجد وردية مفتوحة حالياً. افتح وردية من صفحة "الوردية" لبدء البيع.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card title="📅 مبيعات اليوم" value={sums.day} color="bg-orange" />
        <Card title="🗓️ مبيعات الأسبوع" value={sums.week} color="bg-blue-500" />
        <Card title="📊 مبيعات الشهر" value={sums.month} color="bg-emerald-600" />
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-bold mb-2">اتجاه المبيعات (آخر 7 أيام)</h2>
        {trend.length > 0 ? <SalesTrendChart data={trend} /> : <p className="text-gray-400 text-sm">لا توجد بيانات كافية بعد</p>}
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">الفواتير</h2>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as FilterRange[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filter === f ? 'bg-orange text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f === 'day' ? 'اليوم' : f === 'week' ? 'الأسبوع' : 'الشهر'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">جاري التحميل...</p>
        ) : filteredSales.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد فواتير في هذه الفترة</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500 border-b">
                <th className="py-2">الوقت</th>
                <th>المبلغ</th>
                <th>الدفع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(s.createdAt).toLocaleString('ar-EG')}</td>
                  <td>{s.totalAmount.toFixed(2)}</td>
                  <td>{s.paymentMethod}</td>
                  <td>
                    {s.refundStatus === 'NONE' ? (
                      <span className="text-emerald-600">مكتملة</span>
                    ) : s.refundStatus === 'PARTIAL' ? (
                      <span className="text-amber-600">مسترجعة جزئياً</span>
                    ) : (
                      <span className="text-red-600">مسترجعة بالكامل</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className={`${color} text-white rounded-2xl shadow p-5`}>
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-3xl font-bold mt-2">{value.toFixed(2)}</p>
    </div>
  );
}
