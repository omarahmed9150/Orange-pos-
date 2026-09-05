import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type Lang = 'ar' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  ar: {
    dashboard: 'لوحة التحكم',
    pos: 'نقطة البيع',
    sales: 'الفواتير والاسترجاع',
    shifts: 'الوردية',
    products: 'المنتجات',
    inventory: 'المخزون والجرد',
    reports: 'التقارير والتحليلات',
    auditLog: 'سجل التدقيق',
    purchases: 'فواتير الشراء',
    suppliers: 'الموردون',
    customers: 'العملاء والديون',
    receiptDesigner: 'مصمم الأوصلة',
    barcodeLabels: 'ملصقات الباركود',
    expenses: 'المصاريف',
    settings: 'الإعدادات',
    users: 'المستخدمون',
    logout: 'تسجيل الخروج',
    login: 'تسجيل الدخول',
    username: 'اسم المستخدم',
    password: 'كلمة السر',
    total: 'الإجمالي',
    cart_empty: 'السلة فارغة - امسح باركود للبدء',
  },
  en: {
    dashboard: 'Dashboard',
    pos: 'Point of Sale',
    sales: 'Invoices & Refunds',
    shifts: 'Shift',
    products: 'Products',
    inventory: 'Inventory & Stock Count',
    reports: 'Reports & Analytics',
    auditLog: 'Audit Log',
    purchases: 'Purchase Invoices',
    suppliers: 'Suppliers',
    customers: 'Customers & Debt',
    receiptDesigner: 'Receipt Designer',
    barcodeLabels: 'Barcode Labels',
    expenses: 'Expenses',
    settings: 'Settings',
    users: 'Users',
    logout: 'Log out',
    login: 'Login',
    username: 'Username',
    password: 'Password',
    total: 'Total',
    cart_empty: 'Cart is empty - scan a barcode to start',
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const LANG_KEY = 'orange_lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || 'ar');

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(l: Lang) {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }

  function t(key: string) {
    return translations[lang][key] ?? translations.ar[key] ?? key;
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
