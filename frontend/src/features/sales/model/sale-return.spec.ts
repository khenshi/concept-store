import { reportReturnHref } from './sale-return';

const scope = { organizationId: 'org', branchId: 'branch' };
const target = '/app/organizations/org/branches/branch/reports/transactions';
describe('sale detail report return target', () => {
  it('retains the exact permitted report query', () => {
    const href = `${target}?preset=CUSTOM&fromDay=2026-10-01&throughDay=2026-10-21&transactionQ=RCPT%20%2B%201&transactionType=SALE&transactionPage=3`;
    expect(reportReturnHref(href, scope)).toBe(href);
  });
  it.each([
    undefined,
    null,
    [],
    ['bad'],
    '',
    'https://external.example',
    '//external.example/path',
    'javascript:alert(1)',
    `${target}#fragment`,
    `${target}\n`,
    `${target} `,
    '/app/organizations/other/branches/branch/reports/transactions',
    '/app/organizations/org/branches/other/reports/transactions',
    '/app/organizations/org/branches/branch/reports/overview',
    `${target}/`,
    `${target}/../transactions`,
    `${target}\\evil`,
    '/app/organizations/org/branches/branch/reports/%74ransactions',
    `${target}?q=${'x'.repeat(4096)}`,
  ])('rejects unsafe or out-of-scope targets: %s', (value) => {
    expect(reportReturnHref(value, scope)).toBeUndefined();
  });
});
