# نشر ORANGE POS على Render وGitHub Pages

## 1. إنشاء الخدمات على Render

1. افتح Render واختر **New > Blueprint**.
2. اربط مستودع `omarahmed9150/Orange-pos-`.
3. اختر الفرع `main`.
4. وافق على إنشاء الخدمات من ملف `render.yaml`.

سيتم إنشاء:

- خدمة Backend باسم `orange-pos-api`.
- قاعدة PostgreSQL باسم `orange-pos-db`.

لا تضع كلمات المرور أو `JWT_SECRET` داخل Git. ملف `render.yaml` يولد `JWT_SECRET` تلقائياً، وRender يربط `DATABASE_URL` بقاعدة PostgreSQL.

## 2. ضبط عنوان الواجهة

بعد اكتمال نشر Backend، انسخ رابط الخدمة، مثل:

```text
https://orange-pos-api.onrender.com
```

في GitHub افتح:

`Settings > Secrets and variables > Actions > Variables`

ثم أنشئ متغيراً باسم:

```text
VITE_API_URL
```

وقيمته:

```text
https://orange-pos-api.onrender.com/api
```

بعد حفظ المتغير، شغّل Workflow **Deploy ORANGE POS web app** مرة أخرى من تبويب **Actions**.

## 3. إعداد CORS

في متغير Render `CORS_ORIGINS` ضع رابط GitHub Pages الكامل:

```text
https://omarahmed9150.github.io
```

إذا كان رابط Pages مختلفاً، استخدم أصل الرابط فقط بدون المسار `/Orange-pos-`.

## 4. الحساب الأول

بعد أول تشغيل، افتح الواجهة وسيظهر إعداد النظام. أنشئ حساب المدير من شاشة الإعداد.

لا تعتمد على حساب `admin` الافتراضي في بيئة الإنتاج، وغيّر كلمة المرور فوراً إذا استُخدم seed.

## ملاحظة قاعدة البيانات

تم تحويل Prisma إلى PostgreSQL. قاعدة SQLite المحلية القديمة لا تُنقل تلقائياً إلى Render. إذا كانت تحتوي بيانات مهمة، يجب تنفيذ تصدير/استيراد منفصل قبل تشغيل الإنتاج.
