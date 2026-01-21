import { StockAlertController } from '../controllers/stockAlert.controller';
import { prisma } from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  prisma: {
    product: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    configuration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('StockAlertController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getStockSummary devuelve métricas básicas', async () => {
    (prisma.product.count as any).mockResolvedValueOnce(100);
    (prisma.product.count as any).mockResolvedValueOnce(5);
    (prisma.product.count as any).mockResolvedValueOnce(20);
    (prisma.product.count as any).mockResolvedValueOnce(75);
    (prisma.product.aggregate as any).mockResolvedValue({ _sum: { stock: 500 } });
    (prisma.$queryRaw as any).mockResolvedValue([{ total_value: 12345 }]);

    const req: any = {};
    const res = mockRes();

    await StockAlertController.getStockSummary(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.totalProducts).toBe(100);
    expect(payload.alertsCount).toBe(25);
    expect(payload.totalUnits).toBe(500);
    expect(payload.totalValue).toBe(12345);
    expect(payload.stockHealth.healthy).toBe(Math.round((75 / 100) * 100));
  });

  test('updateAlertConfig actualiza producto y configuración', async () => {
    (prisma.product.update as any).mockResolvedValue({ id: 'p1', name: 'Prod', minStock: 10 });
    (prisma.configuration.findUnique as any).mockResolvedValue({ value: JSON.stringify({ criticalStock: 2, alertDays: 7, emailNotifications: false }) });
    (prisma.configuration.upsert as any).mockResolvedValue({});

    const req: any = { params: { productId: 'p1' }, body: { minStock: 15, emailNotifications: true } };
    const res = mockRes();

    await StockAlertController.updateAlertConfig(req, res);

    expect(prisma.product.update).toHaveBeenCalled();
    expect(prisma.configuration.upsert).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.product.minStock).toBe(10);
    expect(payload.product.emailNotifications).toBe(true);
  });
});

