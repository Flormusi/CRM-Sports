import axios from 'axios';
import { tnQueue } from '../lib/rateLimiter';
import { PrismaClient } from '@prisma/client';

const baseURL = process.env.TIENDANUBE_API_BASE || 'https://api.tiendanube.com/v1';
const token = process.env.TIENDANUBE_ACCESS_TOKEN || '';
const storeId = process.env.TIENDANUBE_STORE_ID || '';
const prisma = new PrismaClient();

export const tn = axios.create({
  baseURL: `${baseURL}/${storeId}`,
  headers: {
    'Content-Type': 'application/json',
    'Authentication': `bearer ${token}`,
    'User-Agent': 'CRM Sports (support@example.com)',
  },
});

export async function getOrder(id: string) {
  const { data } = await tnQueue.enqueue(() => tn.get(`/orders/${id}`));
  return data;
}

export async function markPacked(orderId: string) {
  await tnQueue.enqueue(() => tn.put(`/orders/${orderId}`, { shipping_status: 'packed' }));
}

export async function setSkuMapping(sku: string, productId: string, variantId: string) {
  const key = `tn_sku_map_${sku}`;
  const value = JSON.stringify({ productId, variantId });
  await prisma.configuration.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function getSkuMapping(sku: string): Promise<{ productId: string, variantId: string } | null> {
  const cfg = await prisma.configuration.findUnique({ where: { key: `tn_sku_map_${sku}` } });
  if (!cfg?.value) return null;
  try {
    const v = JSON.parse(cfg.value);
    if (v.productId && v.variantId) return v;
  } catch {}
  return null;
}

export async function findVariantBySku(sku: string): Promise<{ productId: string, variantId: string } | null> {
  const mapped = await getSkuMapping(sku);
  if (mapped) return mapped;
  try {
    const { data } = await tnQueue.enqueue(() => tn.get(`/products/variants`, { params: { sku } }));
    const v = Array.isArray(data) ? data[0] : data;
    if (v?.product_id && v?.id) {
      await setSkuMapping(sku, String(v.product_id), String(v.id));
      return { productId: String(v.product_id), variantId: String(v.id) };
    }
  } catch {}
  return null;
}

export async function updateVariantStockBySku(sku: string, stock: number) {
  const found = await findVariantBySku(sku);
  if (!found) return;
  await tnQueue.enqueue(() => tn.put(`/products/${found.productId}/variants/${found.variantId}`, { stock }));
}
