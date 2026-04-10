import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '../src/data/defaults';

if (process.env.NODE_ENV === 'production') {
  console.log('Skipping seed in production environment.');
  process.exit(0);
}

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: hashedPassword,
    },
  });

  console.log('已创建默认用户: admin / admin123');

  const allCategories = DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    userId: adminUser.id,
    isSystem: true,
  }));

  for (const cat of allCategories) {
    await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: cat.userId,
          name: cat.name,
          type: cat.type,
        },
      },
      update: {},
      create: cat,
    });
  }

  console.log(`已创建 ${allCategories.length} 个分类`);

  for (const acc of DEFAULT_ACCOUNTS) {
    await prisma.account.upsert({
      where: { id: `default_${adminUser.id}_${acc.name}` },
      update: {},
      create: {
        id: `default_${adminUser.id}_${acc.name}`,
        userId: adminUser.id,
        name: acc.name,
        accountType: acc.accountType,
        icon: acc.icon,
      },
    });
  }

  console.log(`已创建 ${DEFAULT_ACCOUNTS.length} 个默认账户`);
  console.log('数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
