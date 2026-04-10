import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 将现有 float 金额转换为整数（分）
  const entries = await prisma.transactionEntry.findMany();
  for (const entry of entries) {
    await prisma.transactionEntry.update({
      where: { id: entry.id },
      data: { amount: Math.round(entry.amount * 100) },
    });
  }
  console.log(`Migrated ${entries.length} entries to cents.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
