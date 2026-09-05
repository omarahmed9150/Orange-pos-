import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatVariantLabel } from '../lib/format-variant';

interface VariantWithProduct {
  id: string; sku: string; size?: string | null; color?: string | null;
  stockQuantity: number; minStockLevel: number; expiryDate: string | null;
  product: { name: string };
}

interface Movement {
  id: string; type: string; quantity: number; reason: string | null; createdAt: string;
}

export function Inventory() {
  const [alerts, setAlerts] = useState<{ lowStock: VariantWithProduct[]; expiringSoon: VariantWithProduct[]; expired: VariantWithProduct[] } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementVariantId, setMovementVariantId] = useState('');

  async function load() {
    const { data } = await api.get('/inventory/alerts');
    setAlerts(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function applyCount(variantId: string) {
    const countedQuantity = counts[variantId];
    if (countedQuantity === undefined) return;
    await api.post('/inventory/count', { lines: [{ variantId, countedQuantity }] });
    setMessage('تم تحديث الجرد وتسجيل الفرق');
    load();
  }

  async function viewMovements(variantId: string) {
    setMovementVariantId(variantId);
    const { data } = await api.get(`/inventory/movements/${variantId}`);
    setMovements(data);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المخزون والجرد</h1>
      {message && <p className="text-sm text-orange-dark">{message}</p>}

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-3 text-red-600">⚠️ نفاد / انخفاض المخزون</h2>
          <div className="space-y-2">
            {alerts?.lowStock.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm border-b pb-2">
                <div>
                  <p className="font-semibold">{formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color })}</p>
                  <p className="text-gray-400 text-xs">الحالي: {v.stockQuantity} | الحد الأدنى: {v.minStockLevel}</p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="جرد"
                    className="w-16 border rounded px-2 py-1"
                    value={counts[v.id] ?? ''}
                    onChange={(e) => setCounts((prev) => ({ ...prev, [v.id]: Number(e.target.value) }))}
                  />
                  <button onClick={() => applyCount(v.id)} className="bg-orange text-white rounded px-2 py-1 text-xs">تحديث</button>
                  <button onClick={() => viewMovements(v.id)} className="text-blue-600 text-xs">السجل</button>
                </div>
              </div>
            ))}
            {alerts && !alerts.lowStock.length && <p className="text-gray-400 text-sm">لا يوجد نقص حالياً</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-3 text-amber-600">⏳ قرب انتهاء الصلاحية (15 يوم)</h2>
          <div className="space-y-2">
            {alerts?.expiringSoon.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm border-b pb-2">
                <div>
                  <p className="font-semibold">{formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color })}</p>
                  <p className="text-gray-400 text-xs">تنتهي: {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('ar-EG') : '-'}</p>
                </div>
                <button onClick={() => viewMovements(v.id)} className="text-blue-600 text-xs">السجل</button>
              </div>
            ))}
            {alerts && !alerts.expiringSoon.length && <p className="text-gray-400 text-sm">لا يوجد أصناف قريبة من الانتهاء</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-3 text-red-700">⛔ منتهية الصلاحية فعلياً</h2>
          <div className="space-y-2">
            {alerts?.expired.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm border-b pb-2">
                <div>
                  <p className="font-semibold">{formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color })}</p>
                  <p className="text-red-500 text-xs">انتهت في: {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('ar-EG') : '-'}</p>
                </div>
                <button onClick={() => viewMovements(v.id)} className="text-blue-600 text-xs">السجل</button>
              </div>
            ))}
            {alerts && !alerts.expired.length && <p className="text-gray-400 text-sm">لا يوجد أصناف منتهية</p>}
          </div>
        </div>
      </div>

      {movementVariantId && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-3">سجل حركة الصنف</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500 border-b">
                <th className="py-2">النوع</th><th>الكمية</th><th>السبب</th><th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2">{movementTypeLabel(m.type)}</td>
                  <td className={m.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td>{m.reason || '-'}</td>
                  <td>{new Date(m.createdAt).toLocaleString('ar-EG')}</td>
                </tr>
              ))}
              {!movements.length && <tr><td colSpan={4} className="text-center text-gray-400 py-4">لا توجد حركات مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function movementTypeLabel(type: string) {
  return { SALE: 'بيع', REFUND: 'استرجاع', PURCHASE: 'شراء', COUNT_ADJUSTMENT: 'تسوية جرد', MANUAL_ADJUSTMENT: 'تعديل يدوي' }[type] || type;
}
