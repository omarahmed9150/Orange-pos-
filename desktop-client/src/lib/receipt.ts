export type ReceiptElementType =
  | 'logo' | 'storeName' | 'address' | 'contact' | 'divider'
  | 'invoiceMeta' | 'employee' | 'items' | 'totals' | 'qr' | 'footer' | 'policy';

export interface ReceiptConfig {
  storeName: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  logoDataUrl: string; // base64
  footerText: string;
  policyText: string;
  showEmployee: boolean;
  showInvoiceNumber: boolean;
  showDateTime: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showTotal: boolean;
  showPaid: boolean;
  showChange: boolean;
  showQr: boolean;
  showBarcode: boolean;
  elements: ReceiptElementType[];
  /** Optional font size override (px) for each receipt element. */
  elementFontSizes?: Partial<Record<ReceiptElementType, number>>;
  logoPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  storeName: 'ORANGE',
  address: 'العنوان - المدينة',
  phone: '',
  whatsapp: '',
  instagram: '',
  website: '',
  logoDataUrl: '',
  footerText: 'شكراً لتسوقكم معنا',
  policyText: 'يُسمح بالاستبدال خلال 7 أيام مع إبراز الفاتورة',
  showEmployee: true,
  showInvoiceNumber: true,
  showDateTime: true,
  showDiscount: true,
  showTax: true,
  showTotal: true,
  showPaid: true,
  showChange: true,
  showQr: true,
  showBarcode: false,
  elements: ['logo', 'storeName', 'address', 'contact', 'divider', 'invoiceMeta', 'employee', 'divider', 'items', 'divider', 'totals', 'divider', 'qr', 'policy', 'footer'],
  elementFontSizes: {},
  logoPosition: { x: 96, y: 4, width: 110, height: 60 },
};

export const ELEMENT_LABELS: Record<ReceiptElementType, string> = {
  logo: '🖼️ شعار المحل',
  storeName: '🏪 اسم المحل',
  address: '📍 العنوان',
  contact: '📞 التواصل (هاتف/واتساب/انستغرام/موقع)',
  divider: '━━ خط فاصل',
  invoiceMeta: '🧾 رقم الفاتورة والتاريخ',
  employee: '👤 اسم الموظف',
  items: '📦 جدول المنتجات',
  totals: '💰 الإجماليات (خصم/ضريبة/الإجمالي/المدفوع/الباقي)',
  qr: '▦ QR / باركود الفاتورة',
  footer: '💬 نص ختامي',
  policy: '📜 سياسة الاستبدال والإرجاع',
};

interface SampleLine {
  name: string;
  qty: number;
  price: number;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!
  ));
}

/** يبني HTML الوصل الفعلي من القالب + بيانات فاتورة حقيقية (يُستخدم عند البيع والمعاينة) */
export function buildReceiptHtml(
  config: ReceiptConfig,
  invoice: {
    invoiceNumber: string;
    dateTime: string;
    employeeName: string;
    lines: SampleLine[];
    discount: number;
    tax: number;
    total: number;
    paid?: number;
  },
): string {
  const change = invoice.paid !== undefined ? Math.max(0, invoice.paid - invoice.total) : undefined;
  const subtotal = invoice.lines.reduce((s, l) => s + l.qty * l.price, 0);

  const blocks: Record<ReceiptElementType, string> = {
    logo: config.logoDataUrl
      ? `<div style="position:absolute;left:${config.logoPosition?.x ?? 96}px;top:${config.logoPosition?.y ?? 4}px;width:${config.logoPosition?.width ?? 110}px;height:${config.logoPosition?.height ?? 60}px;display:flex;align-items:center;justify-content:center"><img src="${escapeHtml(config.logoDataUrl)}" style="max-width:100%;max-height:100%;object-fit:contain"/></div>`
      : '',
    storeName: `<div style="text-align:center;font-weight:bold;font-size:16px">${escapeHtml(config.storeName)}</div>`,
    address: config.address ? `<div style="text-align:center;font-size:11px">${escapeHtml(config.address)}</div>` : '',
    contact: [config.phone, config.whatsapp, config.instagram, config.website]
      .filter(Boolean)
      .map((c) => `<div style="text-align:center;font-size:10px">${escapeHtml(c)}</div>`)
      .join(''),
    divider: `<hr style="border-top:1px dashed #000"/>`,
    invoiceMeta: [
      config.showInvoiceNumber ? `<div>رقم الفاتورة: ${escapeHtml(invoice.invoiceNumber)}</div>` : '',
      config.showDateTime ? `<div>${escapeHtml(invoice.dateTime)}</div>` : '',
    ].join(''),
    employee: config.showEmployee ? `<div>الموظف: ${escapeHtml(invoice.employeeName)}</div>` : '',
    items: `<table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;word-break:break-word;overflow-wrap:anywhere">${invoice.lines
      .map(
        (l) =>
          `<tr><td style="width:70%;vertical-align:top;word-break:break-word;overflow-wrap:anywhere">${escapeHtml(l.name)} x${l.qty}</td><td style="width:30%;text-align:left;vertical-align:top;white-space:nowrap">${(l.qty * l.price).toFixed(2)}</td></tr>`,
      )
      .join('')}</table>`,
    totals: [
      `<div style="display:flex;justify-content:space-between"><span>المجموع الفرعي</span><span>${subtotal.toFixed(2)}</span></div>`,
      config.showDiscount ? `<div style="display:flex;justify-content:space-between"><span>الخصم</span><span>-${invoice.discount.toFixed(2)}</span></div>` : '',
      config.showTax ? `<div style="display:flex;justify-content:space-between"><span>الضريبة</span><span>${invoice.tax.toFixed(2)}</span></div>` : '',
      config.showTotal ? `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px"><span>الإجمالي</span><span>${invoice.total.toFixed(2)}</span></div>` : '',
      config.showPaid && invoice.paid !== undefined ? `<div style="display:flex;justify-content:space-between"><span>المدفوع</span><span>${invoice.paid.toFixed(2)}</span></div>` : '',
      config.showChange && change !== undefined ? `<div style="display:flex;justify-content:space-between"><span>الباقي</span><span>${change.toFixed(2)}</span></div>` : '',
    ].join(''),
    qr: config.showQr
      ? `<div style="text-align:center;margin-top:6px"><svg width="70" height="70" viewBox="0 0 70 70">${qrPlaceholder(invoice.invoiceNumber)}</svg></div>`
      : '',
    footer: config.footerText ? `<div style="text-align:center;font-size:11px;margin-top:6px">${escapeHtml(config.footerText)}</div>` : '',
    policy: config.policyText ? `<div style="text-align:center;font-size:9px;color:#555;margin-top:4px">${escapeHtml(config.policyText)}</div>` : '',
  };

  const fontSizes = config.elementFontSizes || {};
  return `<div dir="rtl" style="position:relative;width:72mm;max-width:272px;min-height:80px;box-sizing:border-box;font-family:monospace;overflow-wrap:anywhere;word-break:break-word;padding:6px 8px;margin:0 auto;overflow:hidden">${config.elements
    .map((el) => `<div style="font-size:${fontSizes[el] || 11}px;max-width:100%;overflow-wrap:anywhere;word-break:break-word">${blocks[el]}</div>`)
    .join('')}</div>`;
}

// QR مبسّط تمثيلي (بدون مكتبة خارجية) لأغراض المعاينة/الطباعة الأولية
function qrPlaceholder(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const cells: string[] = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if ((hash >> ((x + y * 7) % 24)) & 1) {
        cells.push(`<rect x="${x * 10}" y="${y * 10}" width="9" height="9" fill="#000"/>`);
      }
    }
  }
  return cells.join('');
}
