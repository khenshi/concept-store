import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  normalizeNullableBarcode,
  normalizeRequiredSku,
  trimRequiredString,
} from './product-dto.transforms';
import {
  PRODUCT_PRICE_PATTERN,
  PRODUCT_SKU_PATTERN,
} from './product-validation.constants';

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: 'Handwoven pouch',
    minLength: 2,
    maxLength: 160,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional({ example: 'AMH-01', minLength: 2, maxLength: 32 })
  @Transform(normalizeRequiredSku)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 32)
  @Matches(PRODUCT_SKU_PATTERN, {
    message: 'sku may contain only letters, numbers, and single hyphens',
  })
  sku?: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  @Transform(normalizeNullableBarcode)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string | null;

  @ApiPropertyOptional({ type: String, example: '475.00' })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(PRODUCT_PRICE_PATTERN, {
    message: 'sellingPrice must be positive with at most 2 decimals',
  })
  sellingPrice?: string;
}
