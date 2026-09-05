@echo off
chcp 65001 >nul
echo ============================================
echo   ORANGE POS - بناء نسخة التثبيت الكاملة
echo ============================================
echo.
echo يتطلب هذا السكربت اتصال إنترنت فعّال (لتحميل الحزم مرة واحدة فقط).
echo البرنامج الناتج سيعمل بعدها بالكامل بدون إنترنت.
echo.
pause

REM ==================== 1) الـ Backend ====================
echo.
echo [1/7] تثبيت حزم الـ Backend...
cd backend
call npm install
if errorlevel 1 goto :error

echo.
echo [2/7] إعداد قاعدة بيانات نظيفة (تصبح القالب الأساسي لكل تثبيت جديد)...
if exist orange.db del /q orange.db
call npx prisma generate
if errorlevel 1 goto :error
REM The repository currently contains incremental migrations only. Build the
REM clean SQLite template from the schema, then record those migrations as
REM applied so deployed copies can continue with migrate deploy.
call npx prisma db push --accept-data-loss
if errorlevel 1 goto :error
call npx prisma migrate resolve --applied 20260902155000_add_unit_cost_at_sale
if errorlevel 1 goto :error
call npx prisma migrate resolve --applied 20260902190000_add_mixed_payment_amounts
if errorlevel 1 goto :error
call npx prisma migrate deploy
if errorlevel 1 goto :error
call npx prisma db seed
if errorlevel 1 goto :error

echo.
echo [3/7] بناء الـ Backend...
call npm run build
if errorlevel 1 goto :error
cd ..

REM ==================== 2) الواجهة (Desktop) ====================
echo.
echo [4/7] تثبيت حزم الواجهة...
cd desktop-client
call npm install
if errorlevel 1 goto :error

echo.
echo [5/7] بناء الواجهة...
call npm run build
if errorlevel 1 goto :error

echo.
echo [6/7] بناء عمليات Electron الرئيسية (main/preload)...
call npx tsc -p electron/tsconfig.json
if errorlevel 1 goto :error

echo.
echo [7/7] إنتاج ملف التثبيت (.exe) - يتضمّن الـ Backend كاملاً بالداخل...
echo.
echo هل تريد رفع هذا الإصدار مباشرة إلى GitHub Releases الآن؟
echo (اضغط Y للرفع التلقائي، أو أي زر آخر لإنتاج الملف محلياً فقط)
set /p PUBLISH_CHOICE=اختيارك: 

if /i "%PUBLISH_CHOICE%"=="Y" (
    if "%GH_TOKEN%"=="" (
        echo.
        echo ❌ متغيّر GH_TOKEN غير مضبوط. راجع تعليمات ربط GitHub أولاً.
        goto :error
    )
    call npx electron-builder --win --publish always
) else (
    call npx electron-builder --win --publish never
)
if errorlevel 1 goto :error
cd ..

echo.
echo ============================================
echo   ✅ اكتمل البناء بنجاح
echo   ملف التثبيت الجاهز هنا:
echo   desktop-client\release\
echo ============================================
pause
exit /b 0

:error
echo.
echo ❌ حدث خطأ أثناء البناء - راجع الرسالة أعلاه.
pause
exit /b 1
