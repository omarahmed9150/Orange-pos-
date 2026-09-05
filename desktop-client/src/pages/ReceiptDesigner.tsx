import { ChangeEvent, DragEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  DEFAULT_RECEIPT_CONFIG,
  ELEMENT_LABELS,
  ReceiptConfig,
  ReceiptElementType,
  buildReceiptHtml,
} from '../lib/receipt';

const SAMPLE_INVOICE = {
  invoiceNumber: 'INV-0001',
  dateTime: new Date().toLocaleString('ar-EG'),
  employeeName: 'أحمد محمد',
  lines: [
    { name: 'قميص قطن أسود M', qty: 2, price: 19.99 },
    { name: 'بنطلون جينز أزرق L', qty: 1, price: 34.5 },
  ],
  discount: 5,
  tax: 2.4,
  total: 71.88,
  paid: 100,
};

interface SavedTemplate {
  id: string;
  name: string;
  appliesTo: 'ALL' | 'CASH' | 'DEBT' | 'REFUND';
  isDefault: boolean;
  config: ReceiptConfig;
}

export function ReceiptDesigner() {
  const [config, setConfig] = useState<ReceiptConfig>(DEFAULT_RECEIPT_CONFIG);
  const [name, setName] = useState('القالب الافتراضي');
  const [appliesTo, setAppliesTo] = useState<'ALL' | 'CASH' | 'DEBT' | 'REFUND'>('ALL');
  const [isDefault, setIsDefault] = useState(true);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    const { data } = await api.get('/receipt-templates');
    setTemplates(data);
  }

  useEffect(() => {
    load();
  }, []);

  function update<K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function onLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update('logoDataUrl', reader.result as string);
    reader.readAsDataURL(file);
  }

  function setLogoFile(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => update('logoDataUrl', reader.result as string);
    reader.readAsDataURL(file);
  }

  function onLogoDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setLogoFile(e.dataTransfer.files?.[0]);
  }

  function setElementFontSize(element: ReceiptElementType, value: number) {
    setConfig((prev) => ({
      ...prev,
      elementFontSizes: { ...prev.elementFontSizes, [element]: Math.max(6, Math.min(32, value || 11)) },
    }));
  }

  function updateLogoPosition(key: 'x' | 'y' | 'width' | 'height', value: number) {
    setConfig((prev) => ({
      ...prev,
      logoPosition: {
        x: prev.logoPosition?.x ?? 96,
        y: prev.logoPosition?.y ?? 4,
        width: prev.logoPosition?.width ?? 110,
        height: prev.logoPosition?.height ?? 60,
        [key]: Math.max(0, Math.min(key === 'x' ? 302 : key === 'y' ? 500 : 302, value || 0)),
      },
    }));
  }

  function moveLogo(e: DragEvent<HTMLDivElement>) {
    const canvas = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    updateLogoPosition('x', e.clientX - canvas.left - (config.logoPosition?.width ?? 110) / 2);
    updateLogoPosition('y', e.clientY - canvas.top - (config.logoPosition?.height ?? 60) / 2);
  }

  function onDrop(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    setConfig((prev) => {
      const next = [...prev.elements];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return { ...prev, elements: next };
    });
    setDragIndex(null);
  }

  async function saveTemplate() {
    setMessage('');
    try {
      await api.post('/receipt-templates', { name, appliesTo, isDefault, config });
      setMessage('تم حفظ القالب بنجاح ✅');
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'تعذر حفظ القالب');
    }
  }

  function loadTemplate(t: SavedTemplate) {
    setConfig(t.config);
    setName(t.name);
    setAppliesTo(t.appliesTo);
    setIsDefault(t.isDefault);
  }

  async function deleteTemplate(id: string) {
    await api.delete(`/receipt-templates/${id}`);
    load();
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <h1 className="text-2xl font-bold">مصمم الأوصلة الحرارية (80mm / عرض فعلي 72mm)</h1>

        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-bold">بيانات المحل</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المحل" value={config.storeName} onChange={(v) => update('storeName', v)} />
            <Field label="العنوان" value={config.address} onChange={(v) => update('address', v)} />
            <Field label="الهاتف" value={config.phone} onChange={(v) => update('phone', v)} />
            <Field label="واتساب" value={config.whatsapp} onChange={(v) => update('whatsapp', v)} />
            <Field label="انستغرام" value={config.instagram} onChange={(v) => update('instagram', v)} />
            <Field label="الموقع الإلكتروني" value={config.website} onChange={(v) => update('website', v)} />
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onLogoDrop}
            className="border-2 border-dashed border-gray-200 rounded-lg p-3"
          >
            <label className="block text-sm mb-1">شعار المحل</label>
            <input type="file" accept="image/*" onChange={onLogoUpload} />
            <p className="text-xs text-gray-400 mt-1">يمكنك سحب صورة وإفلاتها هنا</p>
            {config.logoDataUrl && <img src={config.logoDataUrl} className="h-16 mt-2" />}
            {config.logoDataUrl && (
              <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label key={key}>
                    {key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'width' ? 'العرض' : 'الارتفاع'}
                    <input
                      type="number"
                      min={0}
                      value={config.logoPosition?.[key] ?? (key === 'x' ? 96 : key === 'y' ? 4 : key === 'width' ? 110 : 60)}
                      onChange={(e) => updateLogoPosition(key, Number(e.target.value))}
                      className="w-full border rounded px-1 py-1"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-bold">نصوص مخصصة</h2>
          <Field label="النص الختامي" value={config.footerText} onChange={(v) => update('footerText', v)} />
          <Field label="سياسة الاستبدال والإرجاع" value={config.policyText} onChange={(v) => update('policyText', v)} />
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-2">
          <h2 className="font-bold mb-2">إظهار/إخفاء الحقول</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ['showEmployee', 'اسم الموظف'],
                ['showInvoiceNumber', 'رقم الفاتورة'],
                ['showDateTime', 'التاريخ والوقت'],
                ['showDiscount', 'الخصم'],
                ['showTax', 'الضريبة'],
                ['showTotal', 'الإجمالي'],
                ['showPaid', 'المدفوع'],
                ['showChange', 'الباقي'],
                ['showQr', 'QR الفاتورة'],
              ] as [keyof ReceiptConfig, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config[key] as boolean}
                  onChange={(e) => update(key, e.target.checked as any)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold mb-2">ترتيب عناصر الوصل (اسحب لإعادة الترتيب)</h2>
          <div className="space-y-1">
            {config.elements.map((el, i) => (
              <div
                key={`${el}-${i}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="bg-gray-50 hover:bg-orange-light border rounded-lg px-3 py-2 text-sm cursor-move flex items-center gap-2"
              >
                <span className="text-gray-400">⠿</span>
                <span className="flex-1">{ELEMENT_LABELS[el as ReceiptElementType]}</span>
                <label className="text-xs text-gray-500 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  حجم
                  <input
                    type="number"
                    min={6}
                    max={32}
                    value={config.elementFontSizes?.[el] || 11}
                    onChange={(e) => setElementFontSize(el, Number(e.target.value))}
                    className="w-14 border rounded px-1 py-0.5 text-center"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-bold">حفظ القالب</h2>
          {message && <p className="text-sm text-orange-dark">{message}</p>}
          <div className="grid grid-cols-3 gap-3 items-end">
            <Field label="اسم القالب" value={name} onChange={setName} />
            <div>
              <label className="block text-sm mb-1">نوع العملية</label>
              <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as any)} className="w-full border rounded-lg px-3 py-2">
                <option value="ALL">عام (كل العمليات)</option>
                <option value="CASH">نقدي</option>
                <option value="DEBT">دين</option>
                <option value="REFUND">مرتجع</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              اجعله القالب الافتراضي لهذا النوع
            </label>
          </div>
          <button onClick={saveTemplate} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
            حفظ القالب
          </button>
        </div>

        {templates.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-bold mb-2">القوالب المحفوظة</h2>
            <div className="space-y-1">
              {templates.map((t) => (
                <div key={t.id} className="flex justify-between items-center text-sm border-b py-2 last:border-0">
                  <span>
                    {t.name} <span className="text-gray-400">({t.appliesTo})</span>{' '}
                    {t.isDefault && <span className="text-emerald-600">افتراضي</span>}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => loadTemplate(t)} className="text-blue-600">تحميل</button>
                    <button onClick={() => deleteTemplate(t.id)} className="text-red-500">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sticky top-6 h-fit">
        <h2 className="font-bold mb-2 text-center">معاينة حية</h2>
        <style>{`
          .receipt-preview, .receipt-preview * { box-sizing: border-box; }
          .receipt-preview { width: 72mm; max-width: 272px; margin: 0 auto; overflow: hidden; }
          .receipt-preview table { width: 100%; table-layout: fixed; }
          .receipt-preview td, .receipt-preview div, .receipt-preview span {
            max-width: 100%; overflow-wrap: anywhere; word-break: break-word;
          }
          @media print {
            .receipt-preview { width: 72mm !important; max-width: 272px !important; margin: 0 auto !important; padding: 0 !important; }
          }
        `}</style>
        <div
          className="receipt-preview bg-white shadow-lg mx-auto relative overflow-hidden"
          style={{ width: '272px', maxWidth: '100%', margin: '0 auto', padding: 0, boxSizing: 'border-box' }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: buildReceiptHtml(config, SAMPLE_INVOICE) }}
          />
          {config.logoDataUrl && (
            <div
              draggable
              onDragEnd={moveLogo}
              title="اسحب الشعار لتحريكه"
              className="absolute border border-dashed border-orange cursor-move"
              style={{
                left: config.logoPosition?.x ?? 96,
                top: config.logoPosition?.y ?? 4,
                width: config.logoPosition?.width ?? 110,
                height: config.logoPosition?.height ?? 60,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
    </div>
  );
}
