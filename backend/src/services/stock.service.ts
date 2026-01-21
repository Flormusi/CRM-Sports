import { PrismaClient } from '@prisma/client';
import { updateVariantStockBySku } from './tiendanube.service';

const prisma = new PrismaClient();

export async function getComputedStock(productId: string): Promise<number> {
  const agg = await (prisma as any).batch.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  return agg._sum.quantity || 0;
}

export async function addBatch(productId: string, quantity: number, expiresAt?: string, costPrice?: number, opts?: { batchNumber?: string, variantId?: string, shelfLocation?: string }) {
  const batch = await (prisma as any).batch.create({
    data: {
      productId,
      quantity,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      costPrice: typeof costPrice === 'number' ? costPrice : 0,
      batchNumber: opts?.batchNumber,
      variantId: opts?.variantId,
      shelfLocation: opts?.shelfLocation,
    },
  });
  const computed = await getComputedStock(productId);
  await prisma.product.update({ where: { id: productId }, data: { stock: computed } });
  if (opts?.variantId) {
    const variant = await (prisma as any).productVariant.findUnique({ where: { id: opts.variantId } });
    if (variant?.sku) {
      const vStock = await computeVariantStock(opts.variantId);
      await updateVariantStockBySku(variant.sku, vStock);
    }
  }
  return batch;
}

export async function listBatches(productId: string) {
  return (prisma as any).batch.findMany({
    where: { productId },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function deductFromBatches(productId: string, qty: number, variantId?: string): Promise<{ averageCost: number, allocations: Array<{ batchId: string, quantity: number, costPrice: number }> }> {
  if (qty <= 0) return { averageCost: 0, allocations: [] };
  const batches = await (prisma as any).batch.findMany({
    where: { productId, quantity: { gt: 0 }, ...(variantId ? { variantId } : {}) },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
  });
  let remaining = qty;
  let totalCostAccumulated = 0;
  const allocations: Array<{ batchId: string, quantity: number, costPrice: number }> = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    if (take > 0) {
      allocations.push({ batchId: b.id, quantity: take, costPrice: b.costPrice || 0 });
      totalCostAccumulated += take * (b.costPrice || 0);
      remaining -= take;
    }
  }
  if (remaining > 0) {
    if (variantId) {
      try {
        const variant = await (prisma as any).productVariant.findUnique({ where: { id: variantId } });
        const vLabel = variant?.sku || variant?.name || variantId;
        throw new Error(`Stock insuficiente en lotes para la variante ${vLabel}`);
      } catch {
        throw new Error('No hay stock suficiente en los lotes');
      }
    }
    throw new Error('No hay stock suficiente en los lotes');
  }
  const averageCost = qty > 0 ? totalCostAccumulated / qty : 0;
  await (prisma as any).$transaction(async (tx: any) => {
    for (const a of allocations) {
      const batch = await tx.batch.findUnique({ where: { id: a.batchId } });
      if (!batch) continue;
      await tx.batch.update({
        where: { id: a.batchId },
        data: { quantity: batch.quantity - a.quantity },
      });
    }
    const computed = await tx.batch.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    await tx.product.update({ where: { id: productId }, data: { stock: computed._sum.quantity || 0 } });
  });
  return { averageCost, allocations };
}

export async function computeVariantStock(variantId: string): Promise<number> {
  const agg = await (prisma as any).batch.aggregate({
    where: { variantId },
    _sum: { quantity: true },
  });
  return agg._sum.quantity || 0;
}

export async function syncVariantStocksForAllocations(allocs: Array<{ batchId: string }>) {
  const batchIds = Array.from(new Set(allocs.map(a => a.batchId)));
  const batches = await (prisma as any).batch.findMany({ where: { id: { in: batchIds } } });
  const variantIds = Array.from(new Set(batches.map((b: any) => b.variantId).filter(Boolean)));
  for (const vid of variantIds as string[]) {
    const variant = await (prisma as any).productVariant.findUnique({ where: { id: vid as string } });
    if (!variant?.sku) continue;
    const stock = await computeVariantStock(vid as string);
    await updateVariantStockBySku(variant.sku, stock);
  }
}
