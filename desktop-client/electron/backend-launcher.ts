import { app } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

/**
 * يشغّل سيرفر الـ Backend (NestJS) تلقائياً بالخلفية عند فتح البرنامج المُثبَّت،
 * بحيث لا يحتاج المستخدم فتح أي نافذة أوامر أو تشغيل أي شيء يدوياً.
 *
 * آلية العمل:
 * - ملفات الـ Backend المبنية (dist + node_modules + prisma) تُنسَخ داخل حزمة التثبيت
 *   عبر "extraResources" في electron-builder.json.
 * - قاعدة البيانات (orange.db) تُنسَخ أول مرة فقط إلى مجلد بيانات المستخدم (userData)
 *   القابل للكتابة دائماً (بخلاف مجلد التثبيت الذي قد يكون محمياً من الكتابة بويندوز).
 * - يُستخدم Electron نفسه كمحرّك Node (عبر ELECTRON_RUN_AS_NODE) بدل تجميع Node.js منفصل.
 */

let backendProcess: ChildProcess | null = null;

function getBackendResourcesPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', '..', 'backend'); // للتطوير فقط (غير مُستخدَم عملياً لأن الباك اند يعمل منفصلاً بالتطوير)
}

function ensureWritableDatabase(backendResourcesPath: string): string {
  const userDataDir = app.getPath('userData');
  fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, 'orange.db');

  if (!fs.existsSync(dbPath)) {
    const templateDbPath = path.join(backendResourcesPath, 'orange.db');
    const legacyTemplateDbPath = path.join(backendResourcesPath, 'prisma', 'orange.db');
    const sourceDbPath = fs.existsSync(templateDbPath) ? templateDbPath : legacyTemplateDbPath;
    if (fs.existsSync(sourceDbPath)) {
      fs.copyFileSync(sourceDbPath, dbPath);
    }
  }

  return dbPath;
}

function buildSqliteDatabaseUrl(dbPath: string): string {
  const normalized = dbPath.replace(/\\/g, '/');
  return `file:${normalized}`;
}

function getInstanceJwtSecret(): string {
  const secretPath = path.join(app.getPath('userData'), 'jwt-secret');
  if (fs.existsSync(secretPath)) {
    const secret = fs.readFileSync(secretPath, 'utf8').trim();
    if (secret.length >= 32) return secret;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    function tryConnect() {
      const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });
      request.on('error', retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });

      function retry() {
        if (Date.now() > deadline) resolve(false);
        else setTimeout(tryConnect, 300);
      }
    }

    tryConnect();
  });
}

/** يشغّل الـ Backend كعملية فرعية منفصلة، ويُرجع Promise يكتمل بمجرد جاهزية السيرفر لاستقبال الطلبات */
export async function startBackend(): Promise<void> {
  if (!app.isPackaged) return; // بالتطوير: يعمل الـ Backend منفصلاً عبر "npm run start:dev" يدوياً

  const backendResourcesPath = getBackendResourcesPath();
  const dbPath = ensureWritableDatabase(backendResourcesPath);
  const jwtSecret = getInstanceJwtSecret();
  const entryFile = path.join(backendResourcesPath, 'dist', 'main.js');
  const databaseUrl = buildSqliteDatabaseUrl(dbPath);

  if (!fs.existsSync(entryFile)) {
    console.error('ملفات الـ Backend المبنية غير موجودة داخل حزمة التثبيت:', entryFile);
    throw new Error('Backend bundle is missing');
  }

  backendProcess = spawn(process.execPath, [entryFile], {
    cwd: backendResourcesPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', // يجعل Electron يعمل كمحرّك Node عادي بدل فتح نافذة
      DATABASE_URL: databaseUrl,
      JWT_SECRET: process.env.JWT_SECRET && !process.env.JWT_SECRET.includes('CHANGE_ME')
        ? process.env.JWT_SECRET
        : jwtSecret,
      PORT: '3000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  backendProcess.stderr?.setEncoding('utf8');
  backendProcess.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
    console.error(`[Backend] ${chunk.trimEnd()}`);
  });
  backendProcess.stdout?.setEncoding('utf8');
  backendProcess.stdout?.on('data', (chunk: string) => {
    console.log(`[Backend] ${chunk.trimEnd()}`);
  });

  backendProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`توقّف سيرفر الـ Backend بشكل غير متوقع (code: ${code})`, stderr);
    }
  });

  const ready = await waitForHealth(3000, 15000);
  if (!ready) {
    console.error('لم يستجب Backend خلال المهلة المحددة', stderr);
    stopBackend();
    throw new Error('Backend failed to start');
  }
}

export function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}
