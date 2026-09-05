import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { username: string; fullName: string; role: string };
}

const ACTION_LABELS: Record<string, string> = {
  SALE_CREATED: 'إنشاء فاتورة',
  SALE_REFUNDED: 'استرجاع فاتورة',
  USER_CREATED: 'إنشاء مستخدم',
  USER_UPDATED: 'تعديل مستخدم',
  USER_BLOCKED: 'حظر مستخدم',
  PURCHASE_INVOICE_CREATED: 'فاتورة شراء',
  SUPPLIER_PAYMENT_ADDED: 'تسديد دفعة مورد',
  EXPENSE_ADDED: 'تسجيل مصروف',
  STOCK_COUNT_APPLIED: 'تسوية جرد',
  STORE_SETTINGS_UPDATED: 'تعديل إعدادات المحل',
  RECEIPT_TEMPLATE_SAVED: 'حفظ قالب وصل',
  RECEIPT_TEMPLATE_DELETED: 'حذف قالب وصل',
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api.get('/audit-log').then(({ data }) => setEntries(data));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">سجل التدقيق</h1>
      <p className="text-sm text-gray-500">سجل دائم لكل العمليات الحساسة - لا يمكن حذفه من أي واجهة.</p>

      <div className="bg-white rounded-2xl shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-gray-500 border-b">
              <th className="p-3">العملية</th>
              <th>المستخدم</th>
              <th>الوقت</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="p-3 font-semibold">{ACTION_LABELS[e.action] || e.action}</td>
                <td>{e.user.fullName} <span className="text-gray-400 text-xs">({e.user.role})</span></td>
                <td>{new Date(e.createdAt).toLocaleString('ar-EG')}</td>
                <td className="text-xs text-gray-500 max-w-xs truncate">{e.details}</td>
              </tr>
            ))}
            {!entries.length && <tr><td colSpan={4} className="text-center text-gray-400 py-6">لا توجد سجلات بعد</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
