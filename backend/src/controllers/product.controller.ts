import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { addBatch, listBatches, getComputedStock, computeVariantStock } from '../services/stock.service';
import { updateVariantStockBySku } from '../services/tiendanube.service';

export class ProductController {
  private coerceId(id: string): string | number {
    const n = Number(id);
    return Number.isFinite(n) && String(n) === id ? n : id;
  }

  async proxyImage(req: Request, res: Response): Promise<void> {
    try {
      const url = req.query.url as string;
      if (!url) {
        res.status(400).send('url query param required');
        return;
      }
      const axios = (await import('axios')).default;
      const resp = await axios.get(url, { responseType: 'arraybuffer', headers: { Referer: '', 'User-Agent': 'Mozilla/5.0' } });
      const contentType = resp.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(resp.data));
    } catch (e) {
      res.status(502).send('Failed to fetch image');
    }
  }
  async importFromUrl(req: Request, res: Response) {
    try {
      const { url, category } = req.body as { url: string; category?: string };
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'URL requerida' });
        return;
      }
      const axios = (await import('axios')).default;
      let html: string;
      try {
        const resp = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
            'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        html = resp.data as string;
      } catch (e: any) {
        const status = e?.response?.status;
        res.status(status || 502).json({ error: 'No se pudo descargar la página', status });
        return;
      }

      const getMetaFrom = (doc: string, name: string) => {
        const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
        const m = doc.match(re); return m ? m[1] : undefined;
      };
      const textMatch = (re: RegExp) => {
        const m = html.match(re); return m ? m[1] : undefined;
      };

      let workingHtml = html;
      const looksLikeListing = /\/productos\/?$/.test(url) && !getMetaFrom(workingHtml, 'og:title');
      if (looksLikeListing) {
        const firstLink = html.match(/href=["'](\/productos\/[^"']+)["']/i);
        if (firstLink) {
          const productUrl = new URL(firstLink[1], url).href;
          const { data: productHtml } = await axios.get(productUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          workingHtml = productHtml;
        }
      }

      const title = getMetaFrom(workingHtml, 'og:title') || (workingHtml.match(/<title>([^<]+)<\/title>/i)?.[1]) || 'Producto';
      const imageUrl = getMetaFrom(workingHtml, 'og:image') || getMetaFrom(workingHtml, 'twitter:image') || (workingHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*product[^"']*["']/i)?.[1]) || undefined;
      const priceRaw = getMetaFrom(workingHtml, 'product:price:amount') || getMetaFrom(workingHtml, 'og:price:amount') || (workingHtml.match(/itemprop=["']price["'][^>]*content=["']([0-9.,]+)["']/i)?.[1]) || (workingHtml.match(/\$\s*([0-9]+[0-9.,]*)/i)?.[1]);
      const price = priceRaw ? Number(String(priceRaw).replace(/\./g, '').replace(/,/g, '.')) : 0;

      let product;
      try {
        product = await prisma.product.create({
          data: {
            name: title.trim(),
            description: `Importado desde ${url}`,
            price: isNaN(price) ? 0 : price,
            stock: 0,
            minStock: 10,
          }
        });
      } catch (e) {
        product = await prisma.product.create({
          data: {
            name: title.trim(),
            description: `Importado desde ${url}`,
            price: isNaN(price) ? 0 : price,
            stock: 0,
            minStock: 10,
          }
        });
      }

      res.status(201).json({ ...product, image_url: imageUrl });
    } catch (error) {
      console.error('Error importing product from URL:', error);
      res.status(500).json({ error: 'Failed to import product' });
    }
  }
  async createProduct(req: Request, res: Response) {
    try {
      const { name, description, price, image_url, imageUrl, images } = req.body;
      console.log('Creating product:', { name, description, price });
      
      const product = await prisma.product.create({
        data: {
          name,
          description,
          price,
          stock: 0,
          minStock: 10
        }
      });
      const finalUrl = Array.isArray(images) && images.length > 0 ? images[0] : (image_url || imageUrl);
      if (finalUrl) {
        await prisma.configuration.upsert({
          where: { key: `product_image_${product.id}` },
          update: { value: finalUrl },
          create: { key: `product_image_${product.id}`, value: finalUrl }
        });
      }
      
      console.log('Product created:', product);
      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  async getAllProducts(_req: Request, res: Response): Promise<Response> {
    try {
      const products = await prisma.product.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });
      const stocks = await (prisma as any).batch.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      });
      const stockMap = Object.fromEntries((stocks as any[]).map((s: any) => [s.productId, s._sum.quantity || 0]));
      const cfgs = await prisma.configuration.findMany({
        where: { key: { startsWith: 'product_image_' } },
        select: { key: true, value: true }
      });
      const map: Record<string, string> = {};
      cfgs.forEach(c => { map[c.key.replace('product_image_', '')] = c.value || ''; });
      const merged = products.map(p => ({
        ...p,
        stock: stockMap[p.id] ?? p.stock,
        image_url: (p as any).image_url || map[p.id] || null
      }));
      return res.json(merged);
    } catch (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  async getProductById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id: this.coerceId(id) as any }
      });
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const cfg = await prisma.configuration.findUnique({ where: { key: `product_image_${product.id}` } });
      const computedStock = await getComputedStock(product.id);
      const merged = { ...product, stock: computedStock, image_url: (product as any).image_url || cfg?.value || null };
      return res.json(merged);
    } catch (error) {
      console.error('Error fetching product:', error);
      return res.status(500).json({ error: 'Failed to fetch product' });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const product = await prisma.product.delete({
        where: { id: this.coerceId(id) as any }
      });
      return res.json({ message: 'Product deleted successfully', product });
    } catch (error) {
      const code = (error as any)?.code;
      if (code === 'P2003') {
        return res.status(409).json({ error: 'Cannot delete product with associated orders/items' });
      }
      if (code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('Error deleting product:', error);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { name, description, price, image_url, imageUrl, images } = req.body;
      const priceNum = price !== undefined ? Number(price) : undefined;
      
      try {
        const product = await prisma.product.update({
          where: { id: this.coerceId(id) as any },
          data: {
            name,
            description,
            price: priceNum as any,
            updatedAt: new Date()
          }
        });
        const finalUrl = Array.isArray(images) && images.length > 0 ? images[0] : (image_url || imageUrl);
        if (finalUrl) {
          await prisma.configuration.upsert({
            where: { key: `product_image_${product.id}` },
            update: { value: finalUrl },
            create: { key: `product_image_${product.id}`, value: finalUrl }
          });
        }
        return res.json(product);
      } catch (e) {
        const product = await prisma.product.update({
          where: { id: this.coerceId(id) as any },
          data: {
            name,
            description,
            price: priceNum as any,
            updatedAt: new Date()
          }
        });
        return res.json(product);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  async deactivate(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const product = await prisma.product.update({
        where: { id: this.coerceId(id) as any },
        data: {
          stock: 0,
          minStock: 0,
          updatedAt: new Date()
        }
      });
      return res.json({ message: 'Product deactivated', product });
    } catch (error) {
      console.error('Error deactivating product:', error);
      return res.status(500).json({ error: 'Failed to deactivate product' });
    }
  }

  async getLowStock(_req: Request, res: Response): Promise<Response> {
    try {
      const threshold = 10;
      const stocks = await (prisma as any).batch.groupBy({ by: ['productId'], _sum: { quantity: true } });
      const stockMap = Object.fromEntries((stocks as any[]).map((s: any) => [s.productId, s._sum.quantity || 0]));
      const products = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
      const low = products.filter(p => (stockMap[p.id] ?? 0) <= threshold)
        .map(p => ({ ...p, stock: stockMap[p.id] ?? 0 }));
      return res.json(low);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      return res.status(500).json({ error: 'Failed to fetch low stock products' });
    }
  }

  async createBatch(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { quantity, expiresAt, costPrice, variantId, batchNumber, shelfLocation } = req.body;
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'quantity requerido y > 0' });
    }
    const batch = await addBatch(String(id), Number(quantity), expiresAt, typeof costPrice === 'number' ? costPrice : undefined, { variantId: variantId ? String(variantId) : undefined, batchNumber, shelfLocation });
    if (variantId) {
      const variant = await (prisma as any).productVariant.findUnique({ where: { id: String(variantId) } });
      if (variant?.sku) {
        const vStock = await computeVariantStock(String(variantId));
        await updateVariantStockBySku(variant.sku, vStock);
      }
    }
    const computedStock = await getComputedStock(String(id));
    return res.status(201).json({ batch, stock: computedStock });
  }

  async listBatches(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const batches = await listBatches(String(id));
    const computedStock = await getComputedStock(String(id));
    return res.json({ batches, stock: computedStock });
  }

  async getByBarcode(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.params;
      const product = await (prisma as any).product.findFirst({ where: { barcode: String(code) } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const cfg = await prisma.configuration.findUnique({ where: { key: `product_image_${product.id}` } });
      const computedStock = await getComputedStock(product.id);
      const merged = { ...product, stock: computedStock, image_url: (product as any).image_url || cfg?.value || null };
      return res.json(merged);
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      return res.status(500).json({ error: 'Failed to fetch product by barcode' });
    }
  }
}
