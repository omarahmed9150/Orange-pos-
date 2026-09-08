import { app, BrowserWindow, ipcMain, BrowserWindowConstructorOptions } from 'electron';
import fs from 'fs';
import path from 'path';
import { getLicenseStatus, activateLicense } from './license';
import { initAutoUpdater } from './updater';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let errorWindow: BrowserWindow | null = null;

function showFatalError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('Fatal Electron error:', message);
  if (!app.isReady()) return;
  if (errorWindow && !errorWindow.isDestroyed()) {
    errorWindow.focus();
    return;
  }
  errorWindow = new BrowserWindow({
    width: 760,
    height: 460,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  errorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html><meta charset="utf-8"><title>ORANGE POS</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;background:#fff7ed;color:#431407}
    h1{color:#ea580c}pre{white-space:pre-wrap;background:#ffedd5;padding:16px;border-radius:8px}</style>
    <h1>تعذر تشغيل ORANGE POS</h1><p>حدث خطأ أثناء تشغيل التطبيق. أغلق النافذة وأعد المحاولة.</p>
    <pre>${message.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))}</pre>
  `)}`);
}

process.on('uncaughtException', showFatalError);
process.on('unhandledRejection', showFatalError);

function createMainWindow() {
  const iconPath = path.join(__dirname, '../dist/icon.png');
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
  if (fs.existsSync(iconPath)) windowOptions.icon = iconPath;

  mainWindow = new BrowserWindow({
    ...windowOptions,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function printReceipt(htmlContent: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 80mm auto; margin: 0; }
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 0;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        width: 72mm;
        max-width: 72mm;
        overflow-x: hidden;
      }
  </style>
</head>
<body>${htmlContent}</body>
</html>`;

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (!printWindow.isDestroyed()) printWindow.close();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      finish(new Error('انتهت مهلة الطباعة؛ تحقق من اتصال الطابعة'));
    }, 15000);
    const complete = (error?: Error) => {
      clearTimeout(timeout);
      finish(error);
    };

    printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`,
    ).catch((error) => complete(error instanceof Error ? error : new Error(String(error))));

    printWindow.webContents.on('did-finish-load', () => {
      const print = (silent: boolean) => printWindow.webContents.print(
        {
          silent,
          printBackground: true,
          deviceName: '',
        },
        (success, failureReason) => {
          if (success) {
          complete();
        } else if (silent) {
          print(false);
        } else {
          complete(new Error(failureReason ?? 'Print failed'));
        }
        },
      );
      print(true);
    });

    printWindow.webContents.on('did-fail-load', (_event, _code, description) => {
      complete(new Error(description));
    });
  });
}

app.whenReady().then(async () => {
  createMainWindow();
  if (mainWindow) initAutoUpdater(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('print-receipt', async (_event, htmlContent: string) => {
  if (typeof htmlContent !== 'string' || htmlContent.length > 1_000_000) {
    throw new Error('Invalid receipt content');
  }
  await printReceipt(htmlContent);
  return { success: true };
});

/**
 * فتح درج الكاشير الإلكتروني تلقائياً عبر أمر ESC/POS (نبضة تفعيل)
 * يُرسل عبر منفذ تسلسلي (Serial/USB-Serial) متصل بالطابعة الحرارية التي يتصل بها الدرج (RJ11).
 * يُضبط رقم المنفذ عبر متغيّر البيئة CASH_DRAWER_PORT (مثال: COM3 على ويندوز، /dev/ttyUSB0 على لينكس).
 */
async function openCashDrawer(): Promise<{ success: boolean; message: string }> {
  const portPath = process.env.CASH_DRAWER_PORT;
  if (!portPath) {
    return { success: false, message: 'لم يتم ضبط منفذ درج الكاشير (CASH_DRAWER_PORT) بعد.' };
  }

  try {
    // تحميل ديناميكي لتجنّب كسر التطبيق إذا لم تُثبَّت المكتبة على أجهزة بدون درج كاشير
    const { SerialPort } = await import('serialport');
    const port = new SerialPort({ path: portPath, baudRate: 9600 });
    const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]); // أمر ESC/POS القياسي لفتح الدرج

    await new Promise<void>((resolve, reject) => {
      port.write(pulse, (err) => (err ? reject(err) : resolve()));
    });
    port.close();
    return { success: true, message: 'تم فتح الدرج' };
  } catch (err: any) {
    return { success: false, message: `تعذر فتح الدرج: ${err.message}` };
  }
}

ipcMain.handle('open-cash-drawer', async () => openCashDrawer());

ipcMain.handle('check-license', () => getLicenseStatus());
ipcMain.handle('activate-license', (_event, key: string) => {
  if (typeof key !== 'string' || key.length > 100) {
    return { success: false, message: 'رمز التفعيل غير صحيح' };
  }
  return activateLicense(key);
});

ipcMain.on('product-updated', () => {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('products-changed'));
});
