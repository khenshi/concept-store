import type { z } from 'zod';
import type { posProductSchema } from './pos.schemas';

export interface PosScope {
  organizationId: string;
  branchId: string;
}
export type PosProduct = z.infer<typeof posProductSchema>;
export interface PosCartLine {
  product: PosProduct;
  quantity: number;
  quantityInput: string;
  error?: string;
}
