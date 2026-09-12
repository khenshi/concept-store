import type { z } from 'zod';
import type {
  productCreateSchema,
  productProfileSchema,
  productResponseSchema,
  productPlacementResponseSchema,
  productStatusSchema,
} from './product.schemas';

export type Product = z.infer<typeof productResponseSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductInput = z.infer<typeof productCreateSchema>;
export type ProductProfileInput = z.infer<typeof productProfileSchema>;
export type ProductPlacement = z.infer<typeof productPlacementResponseSchema>;
export interface ProductFilters {
  q?: string;
  merchantId?: string;
  status?: ProductStatus;
}
