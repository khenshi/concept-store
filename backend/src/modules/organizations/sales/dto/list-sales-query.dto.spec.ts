import { ValidationPipe } from '@nestjs/common';
import { ListSalesQueryDto } from './list-sales-query.dto';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (query: unknown) =>
  pipe.transform(query, { type: 'query', metatype: ListSalesQueryDto });
describe('Sales directory query validation', () => {
  it('defaults pagination and accepts expanded staff filters', async () => {
    await expect(validate({})).resolves.toMatchObject({ page: 1, limit: 50 });
    await expect(
      validate({
        q: '  SALE-001  ',
        cashierId: '11111111-1111-4111-8111-111111111111',
        paymentMethod: 'GCASH',
        page: '2',
        limit: '100',
        from: '2026-09-13T00:00:00Z',
        until: '2026-09-14T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      q: 'SALE-001',
      cashierId: '11111111-1111-4111-8111-111111111111',
      paymentMethod: 'GCASH',
      page: 2,
      limit: 100,
    });
  });
  it.each([
    { q: ['SALE-001'] },
    { q: 'x'.repeat(255) },
    { cashierId: '11111111-1111-5111-8111-111111111111' },
    { cashierId: 'not-a-uuid' },
    { paymentMethod: 'BANK_TRANSFER' },
    { page: '0' },
    { page: '1.5' },
    { page: '1e2' },
    { page: '' },
    { page: '21474837' },
    { page: ['1', '2'] },
    { limit: '0' },
    { limit: '101' },
    { from: '2026-02-30T00:00:00Z' },
    { until: '2026-09-13' },
    { from: '2026-09-13T00:00:00+08:00' },
    { from: 'invalid' },
    { createdById: 'untrusted' },
    { merchantId: 'untrusted' },
    { total: '10.00' },
  ])('rejects invalid/untrusted query %j', async (query) => {
    await expect(validate(query)).rejects.toThrow();
  });
});
