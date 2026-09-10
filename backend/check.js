require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('--- جاري فحص المنتجات (صابون) ---');
  console.log('========================================');
  
  const products = await prisma.product.findMany({
    where: {
      name: {
        contains: 'صابون',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      storeId: true,
    },
  });
  console.log(products);

  console.log('\n========================================');
  console.log('--- جاري فحص المستخدمين والـ storeId ---');
  console.log('========================================');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      storeId: true,
      role: true,
    },
  });
  console.log(users);
}

main()
  .catch((error) => {
    console.error('حدث خطأ أثناء الفحص:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });