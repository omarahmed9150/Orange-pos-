import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * التحديث التلقائي: يفحص عند بدء التشغيل، يُنزّل التحديث بصمت بالخلفية،
 * ولا يُثبَّته إلا بعد موافقة صريحة من المستخدم (زر "تحديث الآن" بالواجهة).
 *
 * ⚠️ يتطلب هذا استضافة ملفات التحديث فعلياً على رابط حقيقي محدد في electron-builder.json
 * (حقل publish.url) - بدون ذلك سيفشل الفحص بصمت ولن يحدث شيء (لن يتعطل التطبيق).
 */
export function initAutoUpdater(mainWindow: BrowserWindow) {
  if (!app.isPackaged) return; // لا تحديث تلقائي أثناء التطوير

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    // لا نزعج المستخدم بأخطاء الشبكة العادية (مثال: لا يوجد اتصال إنترنت) - نسجّلها فقط
    console.error('Auto-update error:', err.message);
  });

  ipcMain.handle('restart-and-install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates());

  autoUpdater.checkForUpdates().catch(() => {
    // بدون اتصال إنترنت أو رابط تحديث غير مضبوط بعد - يُتجاهل بصمت
  });
}
