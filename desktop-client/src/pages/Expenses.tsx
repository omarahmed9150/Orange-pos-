import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Expense {
  id: string;
  title: string;
  amount: number;
  notes: string | null;
  createdAt: string;
}

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/expenses');
    setExpenses(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/expenses', { title, amount: Number(amount), notes: notes || undefined });
      setTitle(''); setAmount(''); setNotes('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر تسجيل المصروف');
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المصاريف</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-5 grid grid-cols-4 gap-3 items-end">
        {error && <p className="col-span-4 text-red-600 text-sm">{error}</p>}
        <div className="col-span-1">
          <label className="block text-sm mb-1">البند</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">المبلغ</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div className="col-span-1">
          <label className="block text-sm mb-1">ملاحظات</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <button className="bg-orange text-white rounded-lg py-2 font-semibold">إضافة</button>
      </form>

      <div className="bg-white rounded-2xl shadow">
        <div className="p-4 border-b flex justify-between font-bold">
          <span>الإجمالي</span>
          <span>{total.toFixed(2)}</span>
        </div>
        <div className="divide-y">
          {expenses.map((e) => (
            <div key={e.id} className="p-3 flex justify-between text-sm">
              <div>
                <p className="font-semibold">{e.title}</p>
                {e.notes && <p className="text-gray-400">{e.notes}</p>}
              </div>
              <div className="text-left">
                <p className="font-bold">{e.amount.toFixed(2)}</p>
                <p className="text-gray-400 text-xs">{new Date(e.createdAt).toLocaleString('ar-EG')}</p>
              </div>
            </div>
          ))}
          {!expenses.length && <p className="p-6 text-center text-gray-400">لا توجد مصاريف مسجلة</p>}
        </div>
      </div>
    </div>
  );
}
