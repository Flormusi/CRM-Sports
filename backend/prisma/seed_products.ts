import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = [
    { name: 'Proteína Whey 1kg', description: 'Proteína sabor vainilla', price: 19999, barcode: '890000000001' },
    { name: 'Creatina Monohidratada 300g', description: 'Creatina micronizada', price: 14999, barcode: '890000000002' },
    { name: 'Aminoácidos BCAA 200cps', description: 'BCAA 2:1:1', price: 12999, barcode: '890000000003' },
    { name: 'Pre-Workout 250g', description: 'Pre-entreno cítrico', price: 17999, barcode: '890000000004' },
    { name: 'Glutamina 300g', description: 'Glutamina pura', price: 13999, barcode: '890000000005' },
  ];
  for (const it of items) {
    await prisma.product.upsert({
      where: { barcode: it.barcode },
      update: {},
      create: {
        name: it.name,
        description: it.description,
        price: it.price,
        stock: 0,
        minStock: 10,
        barcode: it.barcode,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
