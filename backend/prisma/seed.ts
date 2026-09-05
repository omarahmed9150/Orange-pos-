import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * محرك تهيئة آمن (Initial Database Seeder)
 * -----------------------------------------
 * القاعدة: هذا السكريبت لا يحذف أي بيانات أو حسابات موجودة إطلاقاً.
 * يعمل فقط عند أول تشغيل (قاعدة بيانات فارغة من الأدمن):
 *   - إذا لا يوجد أي حساب Super Admin -> ينشئ حساب افتراضي واحد فقط.
 *   - إذا كانت قاعدة البيانات تحتوي مستخدمين بالفعل -> لا يفعل شيء بخصوص المستخدمين إطلاقاً.
 * كل عمليات إضافة/تعديل/حذف المستخدمين بعد ذلك تتم حصراً من لوحة تحكم Super Admin
 * عبر UsersModule (وليس من هذا الملف).
 */
async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
  });

  if (existingAdmin) {
    console.log('يوجد حساب Super Admin مسبقاً - تخطي إنشاء حساب جديد.');
  } else {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        fullName: 'المدير العام',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    console.log('تم إنشاء حساب Super Admin افتراضي:');
    console.log(`  اسم المستخدم: ${admin.username}`);
    console.log(`  كلمة السر المؤقتة: ${defaultPassword}`);
    console.log('  ⚠️ يجب تغيير كلمة السر فوراً بعد أول تسجيل دخول.');
  }

  // بيانات تجريبية للمنتجات فقط عند قاعدة بيانات فارغة تماماً من المنتجات
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.create({
      data: {
        name: 'Classic Cotton T-Shirt',
        category: 'T-Shirts',
        variants: {
          create: [
            {
              sku: 'TSH-BLK-M-001',
              barcode: '8901234567891',
              size: 'M',
              color: 'Black',
              costPrice: 8.0,
              sellingPrice: 19.99,
              stockQuantity: 40,
              minStockLevel: 5,
            },
          ],
        },
      },
    });
    console.log('تم إدخال منتج تجريبي واحد (يمكن حذفه لاحقاً من الواجهة).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
