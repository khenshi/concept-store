import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import {
  normalizeOptionalSku,
  trimOptionalString,
  trimRequiredString,
} from './product-dto.transforms';

export class CreateProductDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Active merchant in this organization; ownership cannot be reassigned',
  })
  @IsUUID('4')
  merchantId!: string;

  @ApiProperty({ example: 'Amihan Ceramic Vase', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: 'AMIHAN-VASE', minLength: 2, maxLength: 32 })
  @Transform(normalizeOptionalSku)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  sku?: string | null;

  @ApiPropertyOptional({
    example: '0001234567890',
    minLength: 1,
    maxLength: 64,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9-]+$/)
  barcode?: string | null;
}
