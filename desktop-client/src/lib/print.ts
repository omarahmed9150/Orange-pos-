export async function printHtml(html: string): Promise<void> {
  const electron = (window as any).electronAPI;
  if (electron?.printReceipt) {
    await electron.printReceipt(html);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'print');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const cleanup = () => frame.remove();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('انتهت مهلة الطباعة؛ تحقق من اتصال الطابعة'));
    }, 15000);

    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        window.clearTimeout(timeout);
        cleanup();
        reject(new Error('تعذر تجهيز نافذة الطباعة'));
        return;
      }
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => {
        window.clearTimeout(timeout);
        cleanup();
        resolve();
      }, 1000);
    };
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 80mm; max-width: 80mm; }
      body { overflow-x: hidden; }
    </style></head><body>${html}</body></html>`;
  });
}
