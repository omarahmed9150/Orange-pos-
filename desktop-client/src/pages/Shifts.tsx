import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Shift {
  id: string;
  startTime: string;
  initialCash: number;
  status: 'OPEN' | 'CLOSED';
}

interface ShiftSummary {
  cashSalesTotal: number;
  cardSalesTotal: number;
  totalSales: number;
  saleCount: number;
  expectedCash: number;
}

export function Shifts() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [initialCash, setInitialCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/shifts/open/me');
    setShift(data ?? null);
    if (data?.id) {
      const { data: s } = await api.get(`/shifts/${data.id}/summary`);
      setSummary(s);
    } else {
      setSummary(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openShift() {
    setError('');
    try {
      await api.post('/shifts/open', { initialCash: Number(initialCash) || 0, notes });
      setInitialCash('');
      setNotes('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر فتح الوردية');
    }
  }

  async function closeShift() {
    if (!shift) return;
    setError('');
    try {
      await api.patch(`/shifts/${shift.id}/close`, { actualCash: Number(actualCash) || 0, notes });
      setActualCash('');
      setNotes('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إغلاق الوردية');
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">إدارة الوردية</h1>

      {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      {!shift ? (
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="font-bold">فتح وردية جديدة</h2>
          <div>
            <label className="block text-sm mb-1">الرصيد الافتتاحي</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={initialCash}
              onChange={(e) => setInitialCash(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">ملاحظات (اختياري)</label>
            <input className="w-full border rounded-lg px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button onClick={openShift} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
            فتح الوردية
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="font-bold">وردية مفتوحة منذ {new Date(shift.startTime).toLocaleString('ar-EG')}</h2>

          {summary && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="عدد الفواتير" value={summary.saleCount} />
              <Stat label="إجمالي المبيعات" value={summary.totalSales.toFixed(2)} />
              <Stat label="مبيعات نقدية" value={summary.cashSalesTotal.toFixed(2)} />
              <Stat label="مبيعات بطاقة" value={summary.cardSalesTotal.toFixed(2)} />
              <Stat label="الكاش المتوقع بالدرج" value={summary.expectedCash.toFixed(2)} highlight />
            </div>
          )}

          <div className="border-t pt-4">
            <label className="block text-sm mb-1">الكاش الفعلي بالدرج (عند الإغلاق)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
            />
            <button
              onClick={closeShift}
              className="mt-3 bg-gray-800 text-white rounded-lg px-4 py-2 font-semibold"
            >
              إغلاق الوردية
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-orange-light' : 'bg-gray-50'}`}>
      <p className="text-gray-500">{label}</p>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
}
