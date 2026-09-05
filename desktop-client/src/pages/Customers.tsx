import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface Statement {
  customer: Customer & { sales: any[]; payments: any[] };
  debtInfo: { remainingDebt: number; daysSinceOldestDebt: number; isOverdue: boolean };
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<Statement | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  async function load() {
    const [{ data: list }, { data: overdue }] = await Promise.all([
      api.get('/customers'),
      api.get('/customers/alerts/overdue-debt'),
    ]);
    setCustomers(list);
    setOverdueAlerts(overdue);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.post('/customers', { name, phone: phone || undefined });
    setName(''); setPhone(''); setShowForm(false);
    load();
  }

  async function openStatement(id: string) {
    const { data } = await api.get(`/customers/${id}/statement`);
    setSelected(data);
  }

  async function addPayment() {
    if (!selected || !paymentAmount) return;
    await api.post(`/customers/${selected.customer.id}/payments`, { amount: Number(paymentAmount) });
    setPaymentAmount('');
    openStatement(selected.customer.id);
    load();
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">العملاء والديون</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
            {showForm ? 'إلغاء' : '+ عميل جديد'}
          </button>
        </div>

        {overdueAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-4 space-y-1">
            <p className="font-bold text-red-700">⚠️ عملاء لديهم دين متأخر 30 يوماً فأكثر</p>
            {overdueAlerts.map((a) => (
              <p key={a.customer.id} className="text-sm text-red-600">
                {a.customer.name} — دين: {a.remainingDebt.toFixed(2)} (منذ {a.daysSinceOldestDebt} يوم)
              </p>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-5 grid grid-cols-2 gap-3">
            <input placeholder="اسم العميل" value={name} onChange={(e) => setName(e.target.value)} required className="border rounded-lg px-3 py-2" />
            <input placeholder="الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} className="border rounded-lg px-3 py-2" />
            <button className="col-span-2 bg-orange text-white rounded-lg py-2 font-semibold">حفظ</button>
          </form>
        )}

        <div className="bg-white rounded-2xl shadow divide-y">
          {customers.map((c) => {
            const overdue = overdueAlerts.find((a) => a.customer.id === c.id);
            return (
              <button key={c.id} onClick={() => openStatement(c.id)} className="w-full text-right p-4 hover:bg-orange-light flex justify-between items-center">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                </div>
                {overdue && <span className="text-red-600 text-xs font-bold">متأخر بالدين</span>}
              </button>
            );
          })}
          {!customers.length && <p className="p-6 text-center text-gray-400">لا يوجد عملاء بعد</p>}
        </div>
      </div>

      <div>
        {selected ? (
          <div className="bg-white rounded-2xl shadow p-5 space-y-3 sticky top-6">
            <h2 className="font-bold text-lg">{selected.customer.name}</h2>
            {selected.debtInfo.isOverdue && (
              <div className="bg-red-50 text-red-700 rounded-lg p-2 text-sm">
                ⚠️ دين متأخر منذ {selected.debtInfo.daysSinceOldestDebt} يوم
              </div>
            )}
            <div className="flex justify-between font-bold text-red-600 border-t pt-1">
              <span>الدين المتبقي</span><span>{selected.debtInfo.remainingDebt.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <input type="number" placeholder="مبلغ الدفعة" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="flex-1 border rounded-lg px-3 py-2" />
              <button onClick={addPayment} className="bg-emerald-600 text-white rounded-lg px-4">تسديد</button>
            </div>

            <div className="border-t pt-2">
              <p className="text-sm font-bold mb-1">آخر فواتير الدين</p>
              {selected.customer.sales.slice(0, 5).map((s: any) => (
                <div key={s.id} className="flex justify-between text-xs py-1">
                  <span>{new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                  <span>{s.totalAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-center mt-10">اختر عميلاً لعرض كشف حسابه</p>
        )}
      </div>
    </div>
  );
}
