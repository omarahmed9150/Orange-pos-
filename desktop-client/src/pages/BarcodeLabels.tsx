import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { api } from '../lib/api';
import { formatVariantLabel } from '../lib/format-variant';

interface Variant {
  id: string;
  barcode: string | null;
  size?: string | null;
  color?: string | null;
  sellingPrice: number;
  product: { name: string };
}

const LABEL_WIDTH_MM = 50;
const LABEL_HEIGHT_MM = 30;
const CURRENCY = 'IQD';

export function BarcodeLabels() {
  const [products, setProducts] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customBarcode, setCustomBarcode] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [saveCustomProduct, setSaveCustomProduct] = useState(true);

  useEffect(() => {
    api.get('/products')
      .then(({ data }) => {
        setProducts(data.flatMap((p: any) => p.variants
          .filter((v: any) => v.barcode)
          .map((v: any) => ({ ...v, product: { name: p.name } }))));
      })
      .catch(() => setMessage('تعذر تحميل المنتجات'))
      .finally(() => setLoading(false));
  }, []);

  const labels = products.flatMap((variant) =>
    Array.from({ length: selected[variant.id] || 0 }, () => variant),
  );

  function printLabels() {
    if (labels.length) window.print();
  }

  function setQuantity(id: string, value: string) {
    const quantity = Math.max(0, Math.min(999, Number(value) || 0));
    setSelected((previous) => ({ ...previous, [id]: quantity }));
  }

  function generateBarcode() {
    let barcode = '';
    do {
      barcode = `9${Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('')}`;
    } while (products.some((product) => product.barcode === barcode));
    return barcode;
  }

  async function addCustomLabel() {
    const name = customName.trim();
    const price = Number(customPrice);
    const quantity = Math.max(1, Math.min(999, Number(customQuantity) || 1));
    const barcode = customBarcode.trim() || generateBarcode();

    if (!name) {
      setMessage('أدخل اسم المنتج');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setMessage('أدخل سعراً صحيحاً');
      return;
    }
    if (products.some((product) => product.barcode === barcode)) {
      setMessage('رقم الباركود مستخدم مسبقاً');
      return;
    }

    let customVariant: Variant;
    if (saveCustomProduct) {
      try {
        const { data } = await api.post('/products', {
          name,
          category: 'عام',
          variants: [{
            barcode,
            costPrice: 0,
            sellingPrice: price,
            stockQuantity: 0,
          }],
        });
        const savedVariant = data?.variants?.[0];
        if (!savedVariant) throw new Error('لم تتم إعادة الصنف من الخادم');
        customVariant = { ...savedVariant, product: { name } };
        window.localStorage.setItem('product-cache-invalidated', Date.now().toString());
        window.electron?.ipcRenderer?.send('product-updated');
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'تعذر حفظ المنتج في قاعدة البيانات');
        return;
      }
    } else {
      customVariant = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        barcode,
        sellingPrice: price,
        product: { name },
      };
    }
    setProducts((previous) => [...previous, customVariant]);
    setSelected((previous) => ({ ...previous, [customVariant.id]: quantity }));
    setCustomName('');
    setCustomPrice('');
    setCustomBarcode('');
    setCustomQuantity('1');
    setSaveCustomProduct(true);
    setShowCustomModal(false);
    setMessage(saveCustomProduct
      ? `تم حفظ المنتج بالباركود ${barcode} وإضافة ${quantity} ملصقاً`
      : `تمت إضافة ${quantity} ملصقاً جاهزاً للطباعة`);
  }

  return (
    <div className="space-y-4">
      <style>{`
        @page { size: 50mm 30mm; margin: 0; }
        @media print {
          body { margin: 0 !important; padding: 0 !important; }
          .barcode-print-area { display: flex !important; gap: 0 !important; }
          .barcode-label { border: 0 !important; page-break-after: always; break-after: page; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">طباعة ملصقات الباركود</h1>
          <p className="text-sm text-gray-500">قالب حراري قياسي 50 × 30 مم</p>
        </div>
        <button
          onClick={() => { setMessage(''); setShowCustomModal(true); }}
          className="bg-gray-800 text-white rounded-lg px-4 py-2 font-semibold ml-2"
        >
          ＋ إضافة ملصق مخصص
        </button>
        <button
          onClick={printLabels}
          disabled={!labels.length}
          className="bg-orange text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-40"
        >
          🖨️ طباعة مباشرة ({labels.length})
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 print:hidden">
        <h2 className="font-bold mb-3">اختر المنتجات وعدد النسخ</h2>
        {loading && <p className="text-gray-500">جاري التحميل...</p>}
        {!loading && !products.length && <p className="text-gray-400">لا توجد منتجات بباركود.</p>}
        <div className="divide-y">
          {products.map((variant) => (
            <div key={variant.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {formatVariantLabel({ product: { name: variant.product.name }, size: variant.size, color: variant.color })}
                </p>
                <p className="text-xs text-gray-500">{variant.barcode}</p>
              </div>
              <label className="text-sm whitespace-nowrap">
                النسخ
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={selected[variant.id] || ''}
                  onChange={(event) => setQuantity(variant.id, event.target.value)}
                  className="w-20 border rounded px-2 py-1 mr-2"
                />
              </label>
            </div>
          ))}
        </div>
        {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
      </div>

      <div className="barcode-print-area flex flex-wrap gap-2 items-start">
        {labels.map((variant, index) => <BarcodeLabel key={`${variant.id}-${index}`} variant={variant} />)}
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">إضافة ملصق مخصص</h2>
              <button onClick={() => setShowCustomModal(false)} className="text-gray-500 text-xl" aria-label="إغلاق">×</button>
            </div>
            <label className="block text-sm">
              اسم المنتج
              <input value={customName} onChange={(event) => setCustomName(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" autoFocus />
            </label>
            <label className="block text-sm">
              السعر
              <input type="number" min={0} step="0.01" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block text-sm">
              رقم الباركود <span className="text-gray-400">(يُولّد تلقائياً عند تركه فارغاً)</span>
              <input value={customBarcode} onChange={(event) => setCustomBarcode(event.target.value.replace(/\s/g, ''))} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block text-sm">
              عدد النسخ
              <input type="number" min={1} max={999} value={customQuantity} onChange={(event) => setCustomQuantity(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saveCustomProduct} onChange={(event) => setSaveCustomProduct(event.target.checked)} />
              حفظ المنتج والباركود في قاعدة البيانات ليظهر فوراً في شاشة البيع
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCustomModal(false)} className="border rounded-lg px-4 py-2">إلغاء</button>
              <button onClick={addCustomLabel} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">إضافة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarcodeLabel({ variant }: { variant: Variant }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const barcode = variant.barcode || '';

  useEffect(() => {
    if (!svgRef.current || !barcode) return;
    const isEan13 = /^\d{13}$/.test(barcode);
    try {
      JsBarcode(svgRef.current, barcode, {
        format: isEan13 ? 'EAN13' : 'CODE128',
        width: 1.35,
        height: 38,
        margin: 0,
        fontSize: 10,
        textMargin: 2,
        displayValue: false,
      });
    } catch {
      if (svgRef.current) svgRef.current.textContent = '';
    }
  }, [barcode]);

  return (
    <div
      className="barcode-label border border-gray-300 rounded-sm bg-white overflow-hidden flex flex-col items-center justify-between text-center p-1"
      style={{ width: `${LABEL_WIDTH_MM}mm`, height: `${LABEL_HEIGHT_MM}mm`, boxSizing: 'border-box' }}
    >
      <div className="w-full truncate font-bold text-[10px] leading-tight" dir="auto">
        {variant.product.name}
      </div>
      <div className="w-full flex items-center justify-center min-h-0">
        <svg ref={svgRef} className="max-w-full" aria-label={`Barcode ${barcode}`} />
      </div>
      <div className="w-full flex items-center justify-between gap-1 leading-none">
        <span className="font-bold text-[12px] whitespace-nowrap">{variant.sellingPrice.toLocaleString('en-US')} {CURRENCY}</span>
        <span className="text-[9px] tracking-tight whitespace-nowrap">{barcode}</span>
      </div>
    </div>
  );
}
