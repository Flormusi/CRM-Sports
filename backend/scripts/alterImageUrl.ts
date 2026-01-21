import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Product" ALTER COLUMN "imageUrl" TYPE TEXT');
    console.log('Column image_url altered to TEXT successfully');
  } catch (e) {
    console.error('Failed to alter column image_url:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
