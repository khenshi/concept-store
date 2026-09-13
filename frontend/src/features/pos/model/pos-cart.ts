import { posQuantitySchema } from './pos.schemas';
import type { PosCartLine, PosProduct } from './pos.types';

function decimal(cents: bigint): string {
  return `${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, '0')}`;
}
const cents = (price: string) => BigInt(price.replace('.', ''));
export function posLineTotal(line: PosCartLine): string {
  return decimal(cents(line.product.sellingPrice) * BigInt(line.quantity));
}
export function posCartTotal(lines: PosCartLine[]): string {
  return decimal(
    lines.reduce(
      (sum, line) =>
        sum + cents(line.product.sellingPrice) * BigInt(line.quantity),
      BigInt(0),
    ),
  );
}
export function quantityError(
  value: string,
  available: number,
): string | undefined {
  const result = posQuantitySchema.safeParse(value);
  return !result.success
    ? result.error.issues[0]?.message
    : result.data > available
      ? `Only ${available} units are currently available.`
      : undefined;
}
export function addPosProduct(
  lines: PosCartLine[],
  product: PosProduct,
): PosCartLine[] {
  if (!product.eligible || product.quantity === 0)
    throw new Error(`${product.name} is out of stock.`);
  if (
    lines.some((line) =>
      quantityError(line.quantityInput, line.product.quantity),
    )
  )
    throw new Error('Fix cart quantities before adding another product.');
  const existing = lines.find(
    (line) => line.product.branchInventoryId === product.branchInventoryId,
  );
  if (existing) {
    if (existing.product.sellingPrice !== product.sellingPrice)
      throw new Error(
        `The price for ${product.name} changed. Remove it and add it again to review the current price.`,
      );
    if (existing.quantity >= product.quantity)
      throw new Error(
        `Only ${product.quantity} units of ${product.name} are currently available.`,
      );
    return lines.map((line) =>
      line === existing
        ? {
            product,
            quantity: line.quantity + 1,
            quantityInput: String(line.quantity + 1),
          }
        : line,
    );
  }
  if (lines.length >= 100)
    throw new Error('A cart can contain at most 100 different products.');
  return [...lines, { product, quantity: 1, quantityInput: '1' }];
}
