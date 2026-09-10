import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { API_BASE_URL } from '../lib/api';
import { useProductCache } from '../context/ProductCacheContext';
import { Link } from 'react-router-dom';

interface Variant {
  id: string;
  barcode: string | null;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  wholesalePrice: number | null;
  vipPrice: number | null;
  expiryDate: string | null;
}

interface Product {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  variants: Variant[];
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return dateOnly || '';
}

function expiryState(value: string | null): 'expired' | 'soon' | 'normal' | 'none' {
  if (!value) return 'none';
  const expiry = new Date(`${toDateInputValue(value)}T23:59:59.999Z`);
  if (Number.isNaN(expiry.getTime())) return 'none';
  const now = new Date();
  const daysRemaining = (expiry.getTime() - now.getTime()) / 86400000;
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining < 30) return 'soon';
  return 'normal';
}

function expiryWarningClass(value: string | null): string {
  const state = expiryState(value);
  if (state === 'expired') return 'bg-red-100 text-red-700';
  if (state === 'soon') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-50';
}

function expiryLabel(value: string | null): string {
  const state = expiryState(value);
  if (state === 'expired') return `منتهي: ${toDateInputValue(value)}`;
  if (state === 'soon') return `ينتهي قريباً: ${toDateInputValue(value)}`;
  return '';
}

export function Products() {
  const { queryClient } = useProductCache();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [vipPrice, setVipPrice] = useState('');
  const [stock, setStock] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  function onImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function load() {
    const { data } = await api.get('/products');
    setProducts(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name,
        category,
        imageUrl: imageUrl || undefined,
        variants: [
          {
          barcode: barcode || undefined,
            costPrice: Number(costPrice),
            sellingPrice: Number(sellingPrice),
            wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
            vipPrice: vipPrice ? Number(vipPrice) : undefined,
            stockQuantity: Number(stock) || 0,
            expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`).toISOString() : undefined,
          },
        ],
      };
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, {
          name,
          category,
          imageUrl: imageUrl || undefined,
          barcode: barcode || undefined,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
          vipPrice: vipPrice ? Number(vipPrice) : undefined,
          stockQuantity: Number(stock) || 0,
          expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`).toISOString() : null,
        });
      } else {
        await api.post('/products', payload);
      }
      setShowForm(false);
      setEditingProduct(null);
      setName(''); setCategory(''); setBarcode('');
      setCostPrice(''); setSellingPrice(''); setWholesalePrice(''); setVipPrice(''); setStock(''); setExpiryDate(''); setImageUrl('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      window.electron?.ipcRenderer?.send('product-updated');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || (editingProduct ? 'تعذر تعديل المنتج' : 'تعذر إضافة المنتج'));
    }
  }

  function editProduct(product: Product) {
    const variant = product.variants[0];
    if (!variant) return;
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setImageUrl(product.imageUrl || '');
    setBarcode(variant.barcode || '');
    setCostPrice(String(variant.costPrice));
    setSellingPrice(String(variant.sellingPrice));
    setWholesalePrice(variant.wholesalePrice === null ? '' : String(variant.wholesalePrice));
    setVipPrice(variant.vipPrice === null ? '' : String(variant.vipPrice));
    setStock(String(variant.stockQuantity));
    setExpiryDate(toDateInputValue(variant.expiryDate));
    setShowForm(true);
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`هل أنت متأكد من حذف "${product.name}" نهائياً؟`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      window.electron?.ipcRenderer?.send('product-updated');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر حذف المنتج');
    }
  }

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.name} ${product.category} ${product.variants.map((variant) => variant.barcode || '').join(' ')}`
        .toLowerCase()
        .includes(term),
    );
  }, [products, search]);

  async function downloadTemplate() {
    const token = localStorage.getItem('orange_token');
    const res = await fetch(`${API_BASE_URL}/products/import-template`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'orange_import_template.xlsx';
    link.click();
  }

  async function generateBarcode() {
    setGeneratingBarcode(true);
    try {
      const { data } = await api.get('/products/generate-barcode');
      setBarcode(data.barcode);
      setGeneratedBarcode(data.barcode);
    } catch {
      setError('تعذر توليد باركود، حاول مجدداً');
    } finally {
      setGeneratingBarcode(false);
    }
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر استيراد الملف');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">المنتجات</h1>
        <button onClick={() => { setEditingProduct(null); setShowForm(!showForm); }} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
          {showForm ? 'إلغاء' : '+ منتج جديد'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم المنتج أو الفئة أو امسح الباركود..."
          autoFocus
          className="w-full border rounded-lg px-4 py-3"
        />
      </div>

      <div className="bg-white rounded-2xl shadow p-5 space-y-3">
        <h2 className="font-bold">📥 استيراد جماعي من ملف Excel</h2>
        <p className="text-sm text-gray-500">
          نزّل النموذج الفارغ أولاً، عبّئ بياناتك بنفس الأعمدة بالضبط (يمكنك نسخها من نظامك القديم بعد تصديره)، ثم ارفعه هنا.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={downloadTemplate} className="bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 text-sm font-semibold">
            تحميل النموذج الفارغ
          </button>
          <label className="bg-orange text-white rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer">
            {importing ? 'جاري الاستيراد...' : 'اختيار ملف واستيراده'}
            <input type="file" accept=".xlsx" onChange={onImportFile} disabled={importing} className="hidden" />
          </label>
        </div>

        {importResult && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-emerald-600 font-semibold">تم استيراد {importResult.imported} صنف بنجاح</p>
            {importResult.skipped > 0 && (
              <p className="text-amber-600">تم تخطي {importResult.skipped} صنف (SKU مكرر موجود مسبقاً)</p>
            )}
            {importResult.errors.length > 0 && (
              <div className="text-red-600">
                <p className="font-semibold">أخطاء ({importResult.errors.length}):</p>
                <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-5 grid grid-cols-3 gap-3">
          {error && <p className="col-span-3 text-red-600 text-sm">{error}</p>}
          <Input label="اسم المنتج" value={name} onChange={setName} required />
          <Input label="الفئة" value={category} onChange={setCategory} required />
          <div>
            <label className="block text-sm mb-1">الباركود</label>
            <div className="flex gap-1">
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="flex-1 border rounded-lg px-3 py-2" />
              <button
                type="button"
                onClick={generateBarcode}
                disabled={generatingBarcode}
                className="bg-gray-100 hover:bg-orange-light rounded-lg px-3 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                {generatingBarcode ? '...' : 'توليد باركود تلقائي'}
              </button>
            </div>
            {generatedBarcode && generatedBarcode === barcode && (
              <Link to="/barcode-labels" className="text-xs text-orange font-semibold inline-block mt-1">
                فتح طباعة ملصق هذا الباركود
              </Link>
            )}
          </div>
          <Input label="سعر التكلفة" value={costPrice} onChange={setCostPrice} type="number" required />
          <Input label="سعر البيع (مفرد)" value={sellingPrice} onChange={setSellingPrice} type="number" required />
          <Input label="سعر الجملة (اختياري)" value={wholesalePrice} onChange={setWholesalePrice} type="number" />
          <Input label="سعر VIP (اختياري)" value={vipPrice} onChange={setVipPrice} type="number" />
          <Input label="الكمية" value={stock} onChange={setStock} type="number" />
          <Input label="تاريخ انتهاء الصلاحية (اختياري)" value={expiryDate} onChange={setExpiryDate} type="date" />
          <div className="col-span-3">
            <label className="block text-sm mb-1">صورة المنتج (اختياري)</label>
            <input type="file" accept="image/*" onChange={onImageUpload} />
            {imageUrl && <img src={imageUrl} className="h-16 mt-2 rounded-lg" />}
          </div>
          <p className="col-span-3 bg-orange-light text-orange-dark rounded-lg px-3 py-2 font-semibold">
            الربح التقديري: {sellingPrice && costPrice ? (Number(sellingPrice) - Number(costPrice)).toFixed(2) : '0.00'}
          </p>
          <button className="col-span-3 bg-orange text-white rounded-lg py-2 font-semibold">{editingProduct ? 'حفظ التعديلات' : 'حفظ المنتج'}</button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow divide-y">
        {visibleProducts.map((p) => (
          <div key={p.id} className="p-4 flex gap-3">
            {p.imageUrl && <img src={p.imageUrl} className="w-14 h-14 object-cover rounded-lg" />}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">{p.name} <span className="text-sm text-gray-400">({p.category})</span></p>
                <button type="button" title="تعديل المنتج" onClick={() => editProduct(p)} className="text-blue-600 text-lg">✏️</button>
                <button type="button" title="حذف نهائي" onClick={() => deleteProduct(p)} className="text-red-600 text-lg">🗑️</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-lg px-3 py-1.5 text-sm flex items-center gap-2 ${
                      expiryWarningClass(v.expiryDate)
                    }`}
                  >
                    <button
                      type="button"
                      className="underline text-blue-600"
                      onClick={async () => {
                        const price = window.prompt('سعر البيع الجديد', String(v.sellingPrice));
                        const quantity = window.prompt('الكمية الجديدة', String(v.stockQuantity));
                        if (price === null && quantity === null) return;
                        try {
                          const { data } = await api.patch(`/products/variants/${v.id}/quick-update`, {
                            sellingPrice: price === null ? undefined : Number(price),
                            stockQuantity: quantity === null ? undefined : Number(quantity),
                          });
                          setProducts((current) => current.map((product) => ({
                            ...product,
                            variants: product.variants.map((variant) => variant.id === v.id ? data : variant),
                          })));
                          queryClient.invalidateQueries({ queryKey: ['products'] });
                          window.electron?.ipcRenderer?.send('product-updated');
                        } catch (err: any) {
                          setError(err?.response?.data?.message || 'تعذر تعديل المنتج');
                        }
                      }}
                    >
                      تعديل سريع
                    </button>
                    <span className="font-bold">{v.sellingPrice.toFixed(2)}</span>
                    <span className={v.stockQuantity <= v.minStockLevel ? 'text-red-500' : 'text-gray-500'}>
                      مخزون: {v.stockQuantity}
                    </span>
                    {expiryLabel(v.expiryDate) && (
                      <span className="font-semibold">{expiryLabel(v.expiryDate)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {!products.length && <p className="p-6 text-center text-gray-400">لا توجد منتجات بعد</p>}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border rounded-lg px-3 py-2"
      />
    </div>
  );
}
