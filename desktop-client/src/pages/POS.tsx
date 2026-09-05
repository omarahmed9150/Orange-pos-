import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatVariantLabel } from '../lib/format-variant';
import { useAuth } from '../context/AuthContext';
import { useProductCache } from '../context/ProductCacheContext';
import { buildReceiptHtml, DEFAULT_RECEIPT_CONFIG, ReceiptConfig } from '../lib/receipt';
import { printHtml } from '../lib/print';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';

interface Variant {
  id: string;
  sku: string;
  barcode: string | null;
  size: string;
  color: string;
  sellingPrice: number;
  wholesalePrice: number | null;
  vipPrice: number | null;
  stockQuantity: number;
  product: { name: string; imageUrl?: string | null };
}

type PriceTier = 'RETAIL' | 'WHOLESALE' | 'VIP';

interface CartLine {
  variant: Variant;
  quantity: number;
  priceTier: PriceTier;
  overridePrice?: number; // للبيع بالوزن عبر باركود الميزان
}

interface HeldOrder {
  id: string;
  createdAt: string;
  lines: CartLine[];
}

const HOLD_KEY = 'orange_held_orders';

export function POS() {
  const { user } = useAuth();
  const { lastUpdate: productCacheLastUpdate } = useProductCache();
  const [barcode, setBarcode] = useState('');
  const [settings, setSettings] = useState<{
    taxEnabled: boolean;
    taxRate: number;
    currency: string;
    secondaryCurrencyEnabled: boolean;
    secondaryCurrency: string | null;
    exchangeRate: number | null;
  }>({
    taxEnabled: false,
    taxRate: 0,
    currency: 'IQD',
    secondaryCurrencyEnabled: false,
    secondaryCurrency: null,
    exchangeRate: null,
  });
  const [results, setResults] = useState<Variant[]>([]);
  const [availableVariants, setAvailableVariants] = useState<Variant[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountIsPercent, setDiscountIsPercent] = useState(false);
  const [payment, setPayment] = useState<'CASH' | 'CARD' | 'MOBILE' | 'MIXED' | 'DEBT'>('CASH');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomerAlert, setSelectedCustomerAlert] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [mobileAmount, setMobileAmount] = useState('');
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    const raw = localStorage.getItem(HOLD_KEY);
    return raw ? JSON.parse(raw) : [];
  });
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadAvailableProducts() {
    const { data } = await api.get('/products');
    setAvailableVariants(
      data.flatMap((product: any) =>
        product.variants.map((variant: Variant) => ({
          ...variant,
          product: { name: product.name, imageUrl: product.imageUrl },
        })),
      ),
    );
  }

  useEffect(() => {
    api.get('/shifts/open/me').then(({ data }) => setShiftId(data?.id ?? null));
    api.get('/store-settings').then(({ data }) => setSettings(data));
    void loadAvailableProducts();
    inputRef.current?.focus();
  }, []);

  // When products cache is invalidated (new product added from Products page), clear results to force fresh search
  useEffect(() => {
    setResults([]);
    void loadAvailableProducts();
  }, [productCacheLastUpdate]);

  useEffect(() => {
    const ipcRenderer = window.electron?.ipcRenderer;
    if (!ipcRenderer) return;
    const removeListener = ipcRenderer.on('products-changed', () => {
      setResults([]);
      void loadAvailableProducts();
    });
    return removeListener;
  }, []);

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'F9') { e.preventDefault(); if (cart.length) checkout(); }
      if (e.key === 'F4') { e.preventDefault(); if (cart.length) holdOrder(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** يفكّ باركود الميزان الإلكتروني بصيغة EAN-13 (بادئة 2 + PLU 5 خانات + الوزن بالجرام 5 خانات + رقم تحقق) */
  function parseScaleBarcode(code: string): { plu: string; weightKg: number } | null {
    if (!/^2\d{12}$/.test(code)) return null;
    const plu = code.slice(1, 6);
    const weightGrams = parseInt(code.slice(6, 11), 10);
    return { plu, weightKg: weightGrams / 1000 };
  }

  const variantLabel = (v: Variant) => formatVariantLabel({ product: { name: v.product.name }, size: v.size, color: v.color });

  async function onScan(e: FormEvent) {
    const code = barcode.trim();
    if (!code) return;

    const scaleData = parseScaleBarcode(code);
    if (scaleData) {
      try {
        // نبحث عن الصنف عبر أول 6 أرقام (البادئة + PLU) المطابقة لباركود مسجّل مسبقاً في المنتج
        const { data } = await api.get('/products', { params: { q: code.slice(0, 6) } });
        const variant = data.flatMap((p: any) => p.variants.map((v: any) => ({ ...v, product: { name: p.name, imageUrl: p.imageUrl } })))[0];
        if (variant) {
          addToCart(variant, { overridePrice: Number((scaleData.weightKg * variant.sellingPrice).toFixed(2)) });
          setMessage(`تمت إضافة صنف موزون: ${scaleData.weightKg} كغ`);
        } else {
          setMessage('لم يُعثر على صنف مطابق لكود الميزان');
        }
      } catch {
        setMessage('لم يُعثر على صنف مطابق لكود الميزان');
      }
      setBarcode('');
      return;
    }

    try {
      const { data } = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      addToCart(data);
      setBarcode('');
    } catch {
      // لم يُعثر عليه بالباركود -> جرّب كبحث نصي (اسم/SKU)
      const { data } = await api.get('/products', { params: { q: code } });
      const variants: Variant[] = data.flatMap((p: any) =>
        p.variants.map((v: any) => ({ ...v, product: { name: p.name, imageUrl: p.imageUrl } })),
      );
      setResults(variants);
    }
  }

  function addToCart(variant: Variant, opts?: { overridePrice?: number }) {
    setResults([]);
    setCart((prev) => {
      if (!opts?.overridePrice) {
        const existing = prev.find((l) => l.variant.id === variant.id && !l.overridePrice);
        if (existing) {
          return prev.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + 1 } : l,
          );
        }
      }
      return [...prev, { variant, quantity: 1, priceTier: 'RETAIL', overridePrice: opts?.overridePrice }];
    });
  }

  function updateQty(id: string, qty: number) {
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.variant.id !== id) : prev.map((l) => (l.variant.id === id ? { ...l, quantity: qty } : l)),
    );
  }

  function updatePriceTier(id: string, priceTier: PriceTier) {
    setCart((prev) => prev.map((l) => (l.variant.id === id ? { ...l, priceTier } : l)));
  }

  function linePrice(l: CartLine): number {
    if (l.overridePrice !== undefined) return l.overridePrice;
    if (l.priceTier === 'WHOLESALE' && l.variant.wholesalePrice) return l.variant.wholesalePrice;
    if (l.priceTier === 'VIP' && l.variant.vipPrice) return l.variant.vipPrice;
    return l.variant.sellingPrice;
  }

  const subtotal = cart.reduce((sum, l) => sum + linePrice(l) * l.quantity, 0);
  const discountAmount = discountIsPercent ? (subtotal * discount) / 100 : discount;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = settings.taxEnabled ? (taxableAmount * settings.taxRate) / 100 : 0;
  const total = taxableAmount + taxAmount;

  async function searchCustomers(q: string) {
    setCustomerSearch(q);
    if (!q.trim()) { setCustomerResults([]); return; }
    const { data } = await api.get('/customers/search', { params: { q } });
    setCustomerResults(data);
  }

  function selectCustomer(c: any) {
    setCustomerId(c.id);
    setCustomerSearch(c.name);
    setCustomerResults([]);
    if (c.isOverdue) {
      setSelectedCustomerAlert(`⚠️ تنبيه: هذا العميل لديه دين متأخر ${c.daysSinceOldestDebt} يوماً بقيمة ${c.remainingDebt.toFixed(2)}`);
    } else if (c.remainingDebt > 0) {
      setSelectedCustomerAlert(`لدى هذا العميل دين حالي: ${c.remainingDebt.toFixed(2)}`);
    } else {
      setSelectedCustomerAlert(null);
    }
  }

  async function checkout() {
    if (!shiftId) { setMessage('لا توجد وردية مفتوحة. افتح وردية أولاً.'); return; }
    if (!cart.length) return;
    if (payment === 'DEBT' && !customerId) { setMessage('اختر العميل أولاً لتسجيل البيع بالدين'); return; }

    try {
      const { data: sale } = await api.post('/sales', {
        shiftId,
        items: cart.map((l) => ({
          variantId: l.variant.id,
          quantity: l.quantity,
          priceTier: l.priceTier,
          overridePrice: l.overridePrice,
        })),
        discount: Number(discountAmount.toFixed(2)),
        tax: Number(taxAmount.toFixed(2)),
        paymentMethod: payment,
        paidAmount: paidAmount ? Number(paidAmount) : undefined,
        cashAmount: payment === 'MIXED' ? Number(cashAmount || 0) : undefined,
        cardAmount: payment === 'MIXED' ? Number(cardAmount || 0) : undefined,
        mobileAmount: payment === 'MIXED' ? Number(mobileAmount || 0) : undefined,
        customerId: payment === 'DEBT' ? customerId : undefined,
      });

      (window as any).electronAPI?.openCashDrawer?.();
      const receiptHtml = await buildReceiptForSale(sale, cart, total, discountAmount);
      let printMessage = 'تمت عملية البيع بنجاح ✅';
      try {
        await printHtml(receiptHtml);
      } catch (printError) {
        printMessage = `تم البيع بنجاح، لكن تعذرت الطباعة: ${(printError as Error).message}`;
      }
      setCart([]);
      setDiscount(0);
      setPaidAmount('');
      setCashAmount('');
      setCardAmount('');
      setMobileAmount('');
      setCustomerId(null);
      setCustomerSearch('');
      setSelectedCustomerAlert(null);
      setMessage(printMessage);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'فشلت عملية البيع');
    }
  }

  function holdOrder() {
    const held: HeldOrder = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), lines: cart };
    const updated = [...heldOrders, held];
    setHeldOrders(updated);
    localStorage.setItem(HOLD_KEY, JSON.stringify(updated));
    setCart([]);
    setMessage('تم تعليق الفاتورة');
  }

  function resumeOrder(order: HeldOrder) {
    setCart(order.lines);
    const updated = heldOrders.filter((h) => h.id !== order.id);
    setHeldOrders(updated);
    localStorage.setItem(HOLD_KEY, JSON.stringify(updated));
  }

  async function buildReceiptForSale(sale: any, lines: CartLine[], totalAmount: number, discountAmt: number) {
    const receiptType = payment === 'CASH' ? 'CASH' : 'ALL';
    let config: ReceiptConfig = DEFAULT_RECEIPT_CONFIG;
    try {
      const { data } = await api.get('/receipt-templates/active', { params: { type: receiptType } });
      if (data?.config) config = data.config;
    } catch {
      // لا يوجد قالب محفوظ بعد -> استخدام الإعدادات الافتراضية
    }

    const html = buildReceiptHtml(config, {
      invoiceNumber: sale.id.slice(0, 8).toUpperCase(),
      dateTime: new Date(sale.createdAt).toLocaleString('ar-EG'),
      employeeName: user?.fullName || '',
      lines: lines.map((l) => ({ name: variantLabel(l.variant), qty: l.quantity, price: linePrice(l) })),
      discount: discountAmt,
      tax: taxAmount,
      total: totalAmount,
      paid: paidAmount ? Number(paidAmount) : undefined,
    });

    return html;
  }

  function confirmPrint() {
    if (!previewHtml) return;
    setPrinting(true);
    printHtml(previewHtml).catch((err: Error) => {
      setMessage(err.message);
    }).finally(() => {
      setPrinting(false);
      setPreviewHtml(null);
    });
  }

  return (
    <>
    <div className="grid grid-cols-3 gap-6 h-full">
      <div className="col-span-2 space-y-4">
        <form onSubmit={onScan} className="flex gap-2">
          <input
            ref={inputRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="امسح الباركود أو ابحث بالاسم... (F2)"
            className="flex-1 border rounded-lg px-4 py-3 text-lg focus:outline-orange"
          />
          <button className="bg-orange text-white rounded-lg px-6 font-semibold">بحث</button>
        </form>

        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow divide-y max-h-52 overflow-y-auto">
            {results.map((v) => (
              <button
                key={v.id}
                onClick={() => addToCart(v)}
                className="w-full text-right px-4 py-2 hover:bg-orange-light flex items-center justify-between text-sm gap-2"
              >
                <span className="flex items-center gap-2">
                  {v.product.imageUrl && <img src={v.product.imageUrl} className="w-8 h-8 object-cover rounded" />}
                  {variantLabel(v)} - متبقي {v.stockQuantity}
                </span>
                <span className="font-bold">{v.sellingPrice.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {!barcode && results.length === 0 && availableVariants.length > 0 && (
          <div className="bg-white rounded-xl shadow divide-y max-h-52 overflow-y-auto">
            {availableVariants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => addToCart(v)}
                className="w-full text-right px-4 py-2 hover:bg-orange-light flex items-center justify-between text-sm gap-2"
              >
                <span className="flex items-center gap-2">
                  {v.product.imageUrl && <img src={v.product.imageUrl} className="w-8 h-8 object-cover rounded" />}
                  {variantLabel(v)} - متبقي {v.stockQuantity}
                </span>
                <span className="font-bold">{v.sellingPrice.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500 border-b">
                <th className="p-3">الصنف</th>
                <th>مستوى السعر</th>
                <th>السعر</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((l, i) => (
                <tr key={`${l.variant.id}-${i}`} className="border-b last:border-0">
                  <td className="p-3">
                    <span className="flex items-center gap-2">
                      {l.variant.product.imageUrl && <img src={l.variant.product.imageUrl} className="w-8 h-8 object-cover rounded" />}
                      {variantLabel(l.variant)}
                      {l.overridePrice !== undefined && <span className="text-xs text-blue-500"> (بالوزن)</span>}
                    </span>
                  </td>
                  <td>
                    {l.overridePrice !== undefined ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <select
                        value={l.priceTier}
                        onChange={(e) => updatePriceTier(l.variant.id, e.target.value as PriceTier)}
                        className="border rounded px-1 py-1 text-xs"
                      >
                        <option value="RETAIL">مفرد</option>
                        {l.variant.wholesalePrice && <option value="WHOLESALE">جملة</option>}
                        {l.variant.vipPrice && <option value="VIP">VIP</option>}
                      </select>
                    )}
                  </td>
                  <td>{linePrice(l).toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      className="w-16 border rounded px-2 py-1"
                      value={l.quantity}
                      onChange={(e) => updateQty(l.variant.id, Number(e.target.value))}
                    />
                  </td>
                  <td>{(linePrice(l) * l.quantity).toFixed(2)}</td>
                  <td>
                    <button onClick={() => updateQty(l.variant.id, 0)} className="text-red-500">✕</button>
                  </td>
                </tr>
              ))}
              {!cart.length && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">السلة فارغة - امسح باركود للبدء</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {heldOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow p-3">
            <p className="text-sm font-bold mb-2">فواتير معلّقة</p>
            <div className="flex gap-2 flex-wrap">
              {heldOrders.map((h) => (
                <button
                  key={h.id}
                  onClick={() => resumeOrder(h)}
                  className="bg-gray-100 hover:bg-orange-light rounded-lg px-3 py-1 text-sm"
                >
                  {new Date(h.createdAt).toLocaleTimeString('ar-EG')} ({h.lines.length} صنف)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-5 space-y-4 h-fit">
        <h2 className="font-bold text-lg">الفاتورة</h2>

        <div className="flex justify-between text-sm">
          <span>المجموع الفرعي</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            placeholder="الخصم"
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <select
            value={discountIsPercent ? 'percent' : 'fixed'}
            onChange={(e) => setDiscountIsPercent(e.target.value === 'percent')}
            className="border rounded-lg px-2 py-2"
          >
            <option value="fixed">مبلغ</option>
            <option value="percent">%</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">طريقة الدفع</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value as any)} className="w-full border rounded-lg px-3 py-2">
            <option value="CASH">نقدي</option>
            <option value="CARD">بطاقة</option>
            <option value="MOBILE">تحويل</option>
            <option value="MIXED">مزدوج</option>
            <option value="DEBT">دين (آجل)</option>
          </select>
        </div>

        {payment === 'DEBT' && (
          <div className="space-y-1">
            <label className="block text-sm mb-1">العميل</label>
            <input
              value={customerSearch}
              onChange={(e) => searchCustomers(e.target.value)}
              placeholder="ابحث باسم العميل..."
              className="w-full border rounded-lg px-3 py-2"
            />
            {customerResults.length > 0 && (
              <div className="bg-white border rounded-lg shadow divide-y max-h-32 overflow-y-auto">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-right px-3 py-1.5 text-sm hover:bg-orange-light flex justify-between"
                  >
                    <span>{c.name}</span>
                    {c.remainingDebt > 0 && <span className={c.isOverdue ? 'text-red-600' : 'text-amber-600'}>{c.remainingDebt.toFixed(2)}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomerAlert && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{selectedCustomerAlert}</p>
            )}
          </div>
        )}

        {(payment === 'CASH' || payment === 'DEBT') && (
          <div>
            <label className="block text-sm mb-1">{payment === 'DEBT' ? 'دفعة مقدمة (اختياري)' : 'المبلغ المدفوع'}</label>
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        )}

        {payment === 'MIXED' && (
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min="0" placeholder="نقدي" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="border rounded-lg px-2 py-2" />
            <input type="number" min="0" placeholder="بطاقة" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} className="border rounded-lg px-2 py-2" />
            <input type="number" min="0" placeholder="موبايل" value={mobileAmount} onChange={(e) => setMobileAmount(e.target.value)} className="border rounded-lg px-2 py-2" />
          </div>
        )}

        {settings.taxEnabled && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>الضريبة ({settings.taxRate}%)</span>
            <span>{taxAmount.toFixed(2)}</span>
          </div>
        )}

        <div className="border-t pt-3 flex justify-between font-bold text-xl">
          <span>الإجمالي</span>
          <span>{total.toFixed(2)} {settings.currency}</span>
        </div>

        {settings.secondaryCurrencyEnabled && settings.exchangeRate && settings.exchangeRate > 0 && (
          <div className="flex justify-between text-sm text-gray-500 -mt-2">
            <span>ما يعادل</span>
            <span>{(total / settings.exchangeRate).toFixed(2)} {settings.secondaryCurrency}</span>
          </div>
        )}

        {message && <p className="text-sm text-center text-orange-dark">{message}</p>}

        <button onClick={checkout} disabled={!cart.length} className="w-full bg-orange text-white rounded-lg py-3 font-bold disabled:opacity-40">
          دفع وإتمام البيع (F9)
        </button>
        <button onClick={holdOrder} disabled={!cart.length} className="w-full bg-gray-100 rounded-lg py-2 font-semibold disabled:opacity-40">
          تعليق الفاتورة (F4)
        </button>
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
