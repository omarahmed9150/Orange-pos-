import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { api } from '../lib/api';
import { formatVariantLabel } from '../lib/format-variant';

interface Supplier { id: string; name: string; }
interface Variant { id: string; sku: string; size?: string | null; color?: string | null; product: { name: string } }
interface Line { variantId: string; label: string; quantity: number; unitCost: number }

export function Purchases() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Variant[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  async function scanInvoiceImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrText('');
    try {
      const worker = await createWorker('ara+eng');
      const { data } = await worker.recognize(file);
      setOcrText(data.text);
      await worker.terminate();
    } catch {
      setOcrText('تعذّرت قراءة الصورة، حاول بصورة أوضح.');
    } finally {
      setOcrLoading(false);
    }
  }

  useEffect(() => {
    api.get('/suppliers').then(({ data }) => setSuppliers(data));
  }, []);

  async function searchVariants(e: FormEvent) {
    e.preventDefault();
    const { data } = await api.get('/products', { params: { q: search } });
    setResults(data.flatMap((p: any) => p.variants.map((v: any) => ({ ...v, product: { name: p.name } }))));
  }

  function addLine(v: Variant) {
    setLines((prev) => [...prev, { variantId: v.id, label: formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color }), quantity: 1, unitCost: 0 }]);
    setResults([]);
    setSearch('');
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  async function submit() {
    setMessage('');
    if (!supplierId || !lines.length) {
      setMessage('اختر مورداً وأضف صنفاً واحداً على الأقل');
      return;
    }
    try {
      await api.post('/purchases', {
        supplierId,
        invoiceNo: invoiceNo || undefined,
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
        paidAmount: paidAmount ? Number(paidAmount) : 0,
      });
      setLines([]); setInvoiceNo(''); setPaidAmount('');
      setMessage('تم تسجيل فاتورة الشراء وتحديث المخزون ✅');
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'تعذر حفظ الفاتورة');
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">فاتورة شراء جديدة</h1>
      {message && <p className="text-sm text-orange-dark">{message}</p>}

      <div className="bg-white rounded-2xl shadow p-5 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">المورد</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
            <option value="">اختر مورداً</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">رقم الفاتورة (اختياري)</label>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">المبلغ المدفوع فوراً</label>
          <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 space-y-2">
        <h2 className="font-bold">📷 مسح فاتورة ورقية (OCR)</h2>
        <p className="text-xs text-gray-500">
          يستخرج النص من صورة الفاتورة كمساعدة سريعة لإدخال البيانات يدوياً - راجع النتيجة قبل الاعتماد عليها.
        </p>
        <input type="file" accept="image/*" onChange={scanInvoiceImage} />
        {ocrLoading && <p className="text-sm text-gray-400">جاري قراءة الصورة...</p>}
        {ocrText && (
          <textarea readOnly value={ocrText} rows={6} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
        )}
      </div>

      <form onSubmit={searchVariants} className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن صنف لإضافته للفاتورة..." className="flex-1 border rounded-lg px-3 py-2" />
        <button className="bg-gray-800 text-white rounded-lg px-4">بحث</button>
      </form>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow divide-y">
          {results.map((v) => (
            <button key={v.id} onClick={() => addLine(v)} className="w-full text-right px-4 py-2 hover:bg-orange-light text-sm">
              {formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color })} - {v.sku}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-gray-500 border-b">
              <th className="p-3">الصنف</th><th>الكمية</th><th>سعر التكلفة</th><th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-3">{l.label}</td>
                <td><input type="number" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="w-16 border rounded px-2 py-1" /></td>
                <td><input type="number" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} className="w-20 border rounded px-2 py-1" /></td>
                <td>{(l.quantity * l.unitCost).toFixed(2)}</td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={4} className="text-center text-gray-400 py-6">أضف أصنافاً للفاتورة</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center bg-white rounded-2xl shadow p-4">
        <span className="font-bold text-lg">الإجمالي: {total.toFixed(2)}</span>
        <button onClick={submit} className="bg-orange text-white rounded-lg px-6 py-2 font-bold">حفظ الفاتورة وتحديث المخزون</button>
      </div>
    </div>
  );
}
