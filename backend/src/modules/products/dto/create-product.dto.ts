import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
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

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  merchantId!: string;

  @ApiProperty({ example: 'Handwoven pouch', minLength: 2, maxLength: 160 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiProperty({ example: 'AMH-01', minLength: 2, maxLength: 32 })
  @Transform(normalizeRequiredSku)
  @IsString()
  @Length(2, 32)
  @Matches(PRODUCT_SKU_PATTERN, {
    message: 'sku may contain only letters, numbers, and single hyphens',
  })
  sku!: string;

  @ApiPropertyOptional({ nullable: true, example: '4801234567890' })
  @Transform(normalizeNullableBarcode)
  @IsOptional()
  @MaxLength(64)
  @IsString()
  barcode?: string | null;

  @ApiProperty({ type: String, example: '450.00' })
  @Transform(trimRequiredString)
  @Matches(PRODUCT_PRICE_PATTERN, {
    message: 'sellingPrice must be positive with at most 2 decimals',
  })
  sellingPrice!: string;
}
