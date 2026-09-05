interface ReceiptPreviewModalProps {
  html: string;
  onConfirm: () => void;
  onCancel: () => void;
  printing?: boolean;
}

/** نافذة معاينة الوصل قبل الإرسال الفعلي للطابعة الحرارية */
export function ReceiptPreviewModal({ html, onConfirm, onCancel, printing }: ReceiptPreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-gray-900/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold">معاينة الوصل قبل الطباعة</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="bg-white shadow mx-auto" style={{ width: '272px', boxSizing: 'border-box' }}>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 font-semibold"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={printing}
            className="flex-1 bg-orange text-white rounded-lg py-2 font-semibold disabled:opacity-50"
          >
            {printing ? 'جاري الطباعة...' : '🖨️ طباعة'}
          </button>
        </div>
      </div>
    </div>
  );
}
