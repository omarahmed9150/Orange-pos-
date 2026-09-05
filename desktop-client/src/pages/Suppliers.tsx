import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

interface Statement {
  supplier: Supplier;
  invoices: { id: string; invoiceNo: string | null; totalAmount: number; createdAt: string }[];
  payments: { id: string; amount: number; createdAt: string; notes: string | null }[];
  totalPurchases: number;
  totalPaid: number;
  remainingDebt: number;
  daysSinceOldestDebt: number;
  isOverdue: boolean;
}

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<Statement | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  async function load() {
    const [{ data: list }, { data: overdue }] = await Promise.all([
      api.get('/suppliers'),
      api.get('/suppliers/alerts/overdue-debt'),
    ]);
    setSuppliers(list);
    setOverdueAlerts(overdue);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.post('/suppliers', { name, phone: phone || undefined, address: address || undefined });
    setName(''); setPhone(''); setAddress(''); setShowForm(false);
    load();
  }

  async function openStatement(id: string) {
    const { data } = await api.get(`/suppliers/${id}/statement`);
    setSelected(data);
  }

  async function addPayment() {
    if (!selected || !paymentAmount) return;
    await api.post(`/suppliers/${selected.supplier.id}/payments`, { amount: Number(paymentAmount) });
    setPaymentAmount('');
    openStatement(selected.supplier.id);
    load();
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">الموردون</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
            {showForm ? 'إلغاء' : '+ مورد جديد'}
          </button>
        </div>

        {overdueAlerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-1">
            <p className="font-bold text-amber-700">⚠️ ديون مستحقة علينا للموردين منذ 30 يوماً فأكثر</p>
            {overdueAlerts.map((a) => (
              <p key={a.supplier.id} className="text-sm text-amber-700">
                {a.supplier.name} — مستحق: {a.remainingDebt.toFixed(2)} (منذ {a.daysSinceOldestDebt} يوم)
              </p>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-5 grid grid-cols-3 gap-3">
            <input placeholder="اسم المورد" value={name} onChange={(e) => setName(e.target.value)} required className="border rounded-lg px-3 py-2" />
            <input placeholder="الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} className="border rounded-lg px-3 py-2" />
            <input placeholder="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} className="border rounded-lg px-3 py-2" />
            <button className="col-span-3 bg-orange text-white rounded-lg py-2 font-semibold">حفظ</button>
          </form>
        )}

        <div className="bg-white rounded-2xl shadow divide-y">
          {suppliers.map((s) => {
            const overdue = overdueAlerts.find((a) => a.supplier.id === s.id);
            return (
              <button key={s.id} onClick={() => openStatement(s.id)} className="w-full text-right p-4 hover:bg-orange-light flex justify-between items-center">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-gray-500">{s.phone}</p>
                </div>
                {overdue && <span className="text-amber-600 text-xs font-bold">دين متأخر</span>}
              </button>
            );
          })}
          {!suppliers.length && <p className="p-6 text-center text-gray-400">لا يوجد موردون بعد</p>}
        </div>
      </div>

      <div>
        {selected ? (
          <div className="bg-white rounded-2xl shadow p-5 space-y-3 sticky top-6">
            <h2 className="font-bold text-lg">{selected.supplier.name}</h2>
            {selected.isOverdue && (
              <div className="bg-amber-50 text-amber-700 rounded-lg p-2 text-sm">
                ⚠️ دين مستحق علينا للمورد منذ {selected.daysSinceOldestDebt} يوم
              </div>
            )}
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>إجمالي المشتريات</span><span>{selected.totalPurchases.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>إجمالي المدفوع</span><span>{selected.totalPaid.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-red-600 border-t pt-1"><span>الدين المتبقي</span><span>{selected.remainingDebt.toFixed(2)}</span></div>
            </div>

            <div className="flex gap-2">
              <input type="number" placeholder="مبلغ الدفعة" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="flex-1 border rounded-lg px-3 py-2" />
              <button onClick={addPayment} className="bg-emerald-600 text-white rounded-lg px-4">تسديد</button>
            </div>

            <div className="border-t pt-2">
              <p className="text-sm font-bold mb-1">آخر فواتير الشراء</p>
              {selected.invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex justify-between text-xs py-1">
                  <span>{new Date(inv.createdAt).toLocaleDateString('ar-EG')}</span>
                  <span>{inv.totalAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-center mt-10">اختر مورداً لعرض كشف حسابه</p>
        )}
      </div>
    </div>
  );
}
