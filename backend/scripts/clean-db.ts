import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const confirm = process.env.CONFIRM_CLEAN === '1';
  if (!confirm) {
    console.error('Set CONFIRM_CLEAN=1 to proceed');
    process.exit(1);
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoiceItemBatch.deleteMany({});
    await tx.afipInvoice.deleteMany({});
    await tx.invoiceItem.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.batch.deleteMany({});
    await tx.productVariant.deleteMany({});
    await tx.product.deleteMany({});
    await tx.client.deleteMany({});
  });
  console.log('Database cleanup completed');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
