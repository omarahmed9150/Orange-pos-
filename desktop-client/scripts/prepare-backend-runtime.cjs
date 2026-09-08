const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const backend = path.join(root, 'backend');
const runtime = path.join(root, 'backend-runtime');

async function removeRuntimeDirectory(targetPath) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const retryableCodes = new Set(['EPERM', 'EBUSY', 'EACCES']);
      if (!retryableCodes.has(error && error.code)) {
        throw error;
      }
      const delayMs = attempt * 300;
      console.warn(`Retrying backend runtime cleanup (${attempt}/8) after ${delayMs}ms because the folder is still locked: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Unable to remove ${targetPath} after multiple retries. Close any running backend processes and try again.`);
}

(async () => {
  await removeRuntimeDirectory(runtime);
  fs.mkdirSync(runtime, { recursive: true });
  fs.cpSync(path.join(backend, 'dist'), path.join(runtime, 'dist'), { recursive: true });
  fs.cpSync(path.join(backend, 'prisma'), path.join(runtime, 'prisma'), { recursive: true });
  fs.copyFileSync(path.join(backend, 'package.json'), path.join(runtime, 'package.json'));

  execSync('npm install --omit=dev --no-package-lock', {
    cwd: runtime,
    stdio: 'inherit',
  });
  execSync('npx prisma generate --schema prisma/schema.prisma', {
    cwd: runtime,
    stdio: 'inherit',
  });

  const database = path.join(runtime, 'prisma', 'orange.db');
  if (fs.existsSync(database)) {
    fs.copyFileSync(database, path.join(runtime, 'orange.db'));
  }
})();
