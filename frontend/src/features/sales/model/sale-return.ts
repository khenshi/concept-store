import type { PosScope } from '@/features/pos/model/pos.types';

export function reportReturnHref(
  value: unknown,
  scope: PosScope,
): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\#\u0000-\u0020\u007f]/.test(value)
  )
    return undefined;
  const expected = [
    `/app/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/reports/transactions`,
    `/app/organizations/${encodeURIComponent(scope.organizationId)}/reports/all/transactions`,
  ];
  try {
    const url = new URL(value, 'https://internal.invalid');
    if (
      url.origin !== 'https://internal.invalid' ||
      !expected.includes(url.pathname) ||
      value.split('?')[0] !== url.pathname
    )
      return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}
