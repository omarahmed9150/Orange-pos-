import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatVariantLabel } from '../lib/format-variant';
import { useAuth } from '../context/AuthContext';
import { buildReceiptHtml, DEFAULT_RECEIPT_CONFIG, ReceiptConfig } from '../lib/receipt';
import { printHtml } from '../lib/print';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';

interface SaleItem {
  id: string;
  quantity: number;
  refundedQty: number;
  price: number;
  variant: { size: string; color: string; product: { name: string } };
}

interface Sale {
  id: string;
  totalAmount: number;
  discount: number;
  tax: number;
  paidAmount: number | null;
  paymentMethod: string;
  createdAt: string;
  refundStatus: 'NONE' | 'PARTIAL' | 'FULL';
  refundedBy: string | null;
  items: SaleItem[];
  user: { fullName: string };
}

export function SalesHistory() {
  const { hasRole } = useAuth();
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refundQty, setRefundQty] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [exchangeSaleId, setExchangeSaleId] = useState<string | null>(null);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [exchangeResults, setExchangeResults] = useState<any[]>([]);
  const [exchangeNewItems, setExchangeNewItems] = useState<{ variantId: string; label: string; quantity: number; price: number }[]>([]);
  const [exchangeSummary, setExchangeSummary] = useState<{ priceDifference: number; amountDue: number; amountToRefundCustomer: number } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  async function load() {
    const { data: shift } = await api.get('/shifts/open/me');
    setShiftId(shift?.id ?? null);
    if (shift?.id) {
      const { data } = await api.get(`/sales/shift/${shift.id}`);
      setSales(data);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const canRefund = hasRole('SUPER_ADMIN', 'ADMIN', 'MANAGER');

  async function refundFull(saleId: string) {
    setError('');
    try {
      await api.post(`/sales/${saleId}/refund`, { reason: 'استرجاع كامل' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر الاسترجاع');
    }
  }

  async function refundPartial(sale: Sale) {
    setError('');
    const items = sale.items
      .map((i) => ({ saleItemId: i.id, quantity: refundQty[i.id] || 0 }))
      .filter((i) => i.quantity > 0);

    if (!items.length) {
      setError('حدد كمية للاسترجاع الجزئي أولاً');
      return;
    }

    try {
      await api.post(`/sales/${sale.id}/refund`, { items, reason: 'استرجاع جزئي' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر الاسترجاع');
    }
  }

  function openExchange(saleId: string) {
    setExchangeSaleId(exchangeSaleId === saleId ? null : saleId);
    setExchangeSearch('');
    setExchangeResults([]);
    setExchangeNewItems([]);
    setExchangeSummary(null);
    setError('');
  }

  async function searchExchangeVariants(q: string) {
    setExchangeSearch(q);
    if (!q.trim()) { setExchangeResults([]); return; }
    const { data } = await api.get('/products', { params: { q } });
    setExchangeResults(data.flatMap((p: any) => p.variants.map((v: any) => ({ ...v, product: { name: p.name } }))));
  }

  function addExchangeItem(v: any) {
    setExchangeNewItems((prev) => [...prev, { variantId: v.id, label: formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color }), quantity: 1, price: v.sellingPrice }]);
    setExchangeResults([]);
    setExchangeSearch('');
  }

  function updateExchangeQty(index: number, quantity: number) {
    setExchangeNewItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity } : item)));
  }

  function removeExchangeItem(index: number) {
    setExchangeNewItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitExchange(sale: Sale) {
    setError('');
    const returnItems = sale.items
      .map((i) => ({ saleItemId: i.id, quantity: refundQty[i.id] || 0 }))
      .filter((i) => i.quantity > 0);

    if (!returnItems.length) {
      setError('حدد كمية الصنف المُرجَع أولاً (نفس حقول الاسترجاع أعلاه)');
      return;
    }
    if (!exchangeNewItems.length) {
      setError('أضف صنفاً بديلاً واحداً على الأقل');
      return;
    }
    if (!shiftId) {
      setError('لا توجد وردية مفتوحة لتسجيل فاتورة الاستبدال');
      return;
    }

    try {
      const { data } = await api.post(`/sales/${sale.id}/exchange`, {
        returnItems,
        newItems: exchangeNewItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        shiftId,
        reason: 'استبدال',
      });
      setExchangeSummary({
        priceDifference: data.priceDifference,
        amountDue: data.amountDue,
        amountToRefundCustomer: data.amountToRefundCustomer,
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر تنفيذ الاستبدال');
    }
  }

  async function reprint(sale: Sale) {
    const receiptType = sale.paymentMethod === 'CASH' ? 'CASH' : 'ALL';
    let config: ReceiptConfig = DEFAULT_RECEIPT_CONFIG;
    try {
      const { data } = await api.get('/receipt-templates/active', { params: { type: receiptType } });
      if (data?.config) config = data.config;
    } catch {
      // استخدام الإعدادات الافتراضية إن لم يوجد قالب محفوظ
    }

    const html = buildReceiptHtml(config, {
      invoiceNumber: sale.id.slice(0, 8).toUpperCase(),
      dateTime: new Date(sale.createdAt).toLocaleString('ar-EG'),
      employeeName: sale.user?.fullName || '',
      lines: sale.items.map((i) => ({
        name: formatVariantLabel({ product: { name: i.variant.product.name }, size: i.variant.size, color: i.variant.color }),
        qty: i.quantity,
        price: i.price,
      })),
      discount: sale.discount,
      tax: sale.tax,
      total: sale.totalAmount,
      paid: sale.paidAmount ?? undefined,
    });

    setPreviewHtml(html);
  }

  function confirmPrint() {
    if (!previewHtml) return;
    setPrinting(true);
    printHtml(previewHtml).catch((err: Error) => {
      setError(err.message);
    }).finally(() => {
      setPrinting(false);
      setPreviewHtml(null);
    });
  }

  if (!shiftId) {
    return <p className="text-gray-400">لا توجد وردية مفتوحة لعرض فواتيرها.</p>;
  }

  return (
    <>
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الفواتير والاسترجاع</h1>
      {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl shadow divide-y">
        {sales.map((sale) => (
          <div key={sale.id} className="p-4">
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
            >
              <div>
                <p className="font-semibold">{new Date(sale.createdAt).toLocaleString('ar-EG')}</p>
                <p className="text-sm text-gray-500">{sale.paymentMethod} • {sale.items.length} صنف</p>
              </div>
              <div className="text-left">
                <p className="font-bold">{sale.totalAmount.toFixed(2)}</p>
                <StatusBadge status={sale.refundStatus} />
              </div>
            </div>

            {expanded === sale.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {sale.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span>
                      {formatVariantLabel({ product: { name: item.variant.product.name }, size: item.variant.size, color: item.variant.color })} x{item.quantity}
                      {item.refundedQty > 0 && <span className="text-amber-600"> (مسترجع: {item.refundedQty})</span>}
                    </span>
                    {canRefund && sale.refundStatus !== 'FULL' && item.refundedQty < item.quantity && (
                      <input
                        type="number"
                        min={0}
                        max={item.quantity - item.refundedQty}
                        placeholder="كمية الاسترجاع"
                        className="w-24 border rounded px-2 py-1"
                        value={refundQty[item.id] || ''}
                        onChange={(e) =>
                          setRefundQty((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                        }
                      />
                    )}
                  </div>
                ))}

                <div className="flex gap-2 pt-2 flex-wrap">
                  <button
                    onClick={() => reprint(sale)}
                    className="bg-gray-800 text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
                  >
                    🖨️ إعادة الطباعة
                  </button>
                  {canRefund && sale.refundStatus !== 'FULL' && (
                    <>
                      <button
                        onClick={() => refundFull(sale.id)}
                        className="bg-red-500 text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
                      >
                        🔄 استرجاع الفاتورة بالكامل
                      </button>
                      <button
                        onClick={() => refundPartial(sale)}
                        className="bg-amber-500 text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
                      >
                        استرجاع جزئي محدد
                      </button>
                      <button
                        onClick={() => openExchange(sale.id)}
                        className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
                      >
                        ↔️ استبدال
                      </button>
                    </>
                  )}
                </div>

                {exchangeSaleId === sale.id && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      حدّد كمية الصنف المُرجَع من حقول "كمية الاسترجاع" أعلاه، ثم أضف الصنف البديل هنا.
                    </p>

                    <div className="flex gap-2">
                      <input
                        value={exchangeSearch}
                        onChange={(e) => searchExchangeVariants(e.target.value)}
                        placeholder="ابحث عن الصنف البديل..."
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                      />
                    </div>

                    {exchangeResults.length > 0 && (
                      <div className="bg-gray-50 rounded-lg divide-y max-h-32 overflow-y-auto">
                        {exchangeResults.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => addExchangeItem(v)}
                            className="w-full text-right px-3 py-1.5 text-xs hover:bg-orange-light"
                          >
                            {v.product.name} ({v.size}/{v.color}) - {v.sellingPrice.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    )}

                    {exchangeNewItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-blue-50 rounded-lg px-3 py-1.5">
                        <span>{item.label} - {item.price.toFixed(2)}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateExchangeQty(i, Number(e.target.value))}
                            className="w-14 border rounded px-1 py-0.5 text-xs"
                          />
                          <button onClick={() => removeExchangeItem(i)} className="text-red-500 text-xs">✕</button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => submitExchange(sale)}
                      className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
                    >
                      تنفيذ الاستبدال
                    </button>

                    {exchangeSummary && (
                      <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                        <p>فرق السعر: <span className="font-bold">{exchangeSummary.priceDifference.toFixed(2)}</span></p>
                        {exchangeSummary.amountDue > 0 && (
                          <p className="text-red-600">المطلوب تحصيله من الزبون: {exchangeSummary.amountDue.toFixed(2)}</p>
                        )}
                        {exchangeSummary.amountToRefundCustomer > 0 && (
                          <p className="text-emerald-600">المطلوب إرجاعه للزبون: {exchangeSummary.amountToRefundCustomer.toFixed(2)}</p>
                        )}
                        {exchangeSummary.amountDue === 0 && exchangeSummary.amountToRefundCustomer === 0 && (
                          <p className="text-gray-500">لا يوجد فرق سعر</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!sales.length && <p className="p-6 text-center text-gray-400">لا توجد فواتير بعد</p>}
      </div>
    </div>

    {previewHtml && (
      <ReceiptPreviewModal
        html={previewHtml}
        printing={printing}
        onConfirm={confirmPrint}
        onCancel={() => setPreviewHtml(null)}
      />
    )}
    </>
  );
}

function StatusBadge({ status }: { status: Sale['refundStatus'] }) {
  if (status === 'NONE') return <span className="text-emerald-600 text-sm">مكتملة</span>;
  if (status === 'PARTIAL') return <span className="text-amber-600 text-sm">مسترجعة جزئياً</span>;
  return <span className="text-red-600 text-sm">مسترجعة بالكامل</span>;
}
