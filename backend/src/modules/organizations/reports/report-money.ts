// Aggregate money has no single-sale size limit; integer cents avoid Decimal precision caps.
export function netRecordedSales(gross: string, refunded: string) {
  const cents =
    BigInt(gross.replace('.', '')) - BigInt(refunded.replace('.', ''));
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}
