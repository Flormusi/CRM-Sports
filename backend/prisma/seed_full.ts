import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

type SeedRow = { id: string; name: string; price: number; stock: number };
type CsvRow = { titulo: string; precio_num: string; stock_total?: string; product_id: string };

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(content: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return rows;
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  const idxTitulo = header.indexOf('titulo');
  const idxPrecio = header.indexOf('precio_num');
  const idxStock = header.indexOf('stock_total');
  const idxId = header.indexOf('product_id');
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    rows.push({
      titulo: String(cols[idxTitulo] ?? ''),
      precio_num: String(cols[idxPrecio] ?? ''),
      stock_total: cols[idxStock] !== undefined ? String(cols[idxStock]) : undefined,
      product_id: String(cols[idxId] ?? ''),
    });
  }
  return rows;
}

function coerceNumber(n: string | number | undefined): number {
  if (typeof n === 'number') return n;
  if (!n) return 0;
  const s = String(n).trim();
  if (!s) return 0;
  const num = Number(s.replace(/\./g, '').replace(/,/g, '.'));
  return isNaN(num) ? 0 : num;
}

async function readSeedRows(): Promise<SeedRow[]> {
  const expected = 'productos - el nogal.xlsx - Hoja 1_productos.csv';
  const candidates = [
    path.resolve(__dirname, '../../', expected),
    path.resolve(__dirname, '../', expected),
    path.resolve(process.cwd(), expected),
  ];
  let filePath: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      filePath = c;
      break;
    }
  }
  if (!filePath) {
    return (rows as any[]).map((r: any) => ({
      id: String(r.id),
      name: String(r.n),
      price: Number(r.p) || 0,
      stock: Number(r.s) || 0,
    }));
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseCSV(content);
  return parsed.map(r => ({
    id: r.product_id,
    name: r.titulo,
    price: coerceNumber(r.precio_num),
    stock: coerceNumber(r.stock_total),
  })).filter(r => r.id && r.name);
}
const rows: Array<{ id: string; n: string; p: number; s: number; c: string }> = [
  { "id": "289441500", "n": "Productos Generales", "p": 4100, "s": 0, "c": "Varios" },
  { "id": "259305430", "n": "Advanced Whey Xtrenght 1kg + Creatina Xtrenght 250gr", "p": 21840, "s": 0, "c": "Combos" },
  { "id": "209160300", "n": "Age Biologique Hair Complex 60 caps", "p": 10800, "s": 8, "c": "Salud" },
  { "id": "66962231", "n": "Age Biologique Hydrolyzed Collagen 200grs", "p": 27750, "s": 9, "c": "Colágenos" },
  { "id": "66962234", "n": "Age Biologique Hydrolyzed Collagen 60 caps", "p": 14650, "s": 11, "c": "Colágenos" },
  { "id": "69505352", "n": "Age Biologique Hydrolyzed Collagen con te blanco 200grs", "p": 11600, "s": 16, "c": "Colágenos" },
  { "id": "76119588", "n": "Animal Creatina 300grs", "p": 97440, "s": 3, "c": "Creatinas" },
  { "id": "76119589", "n": "Animal Creatina 500grs", "p": 97440, "s": 2, "c": "Creatinas" },
  { "id": "66961735", "n": "Animal Cuts 44 Serv Mango-Naranja", "p": 28710, "s": 2, "c": "Quemadores" }
  // ... podés seguir pegando el resto de las filas del CSV aquí
];

async function main() {
  await prisma.batch.deleteMany();
  await prisma.product.deleteMany();

  const expiresAt = new Date('2027-01-01T00:00:00.000Z');

  const seedRows = await readSeedRows();
  for (const r of seedRows) {
    const barcode = `NOG-${r.id}`;
    const product = await prisma.product.create({
      data: {
        name: r.name,
        description: 'El Nogal',
        price: Number(r.price) || 0,
        stock: 0,
        minStock: 10,
        barcode,
      },
    });
    const qty = Number(r.stock) || 0;
    if (qty > 0) {
      await prisma.batch.create({
        data: {
          productId: product.id,
          quantity: qty,
          costPrice: 0,
          expiresAt,
          batchNumber: `INIT-${r.id}`,
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
