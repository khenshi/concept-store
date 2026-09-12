import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  normalizeNullableSku,
  trimNullableString,
  trimRequiredString,
} from './product-dto.transforms';

export class UpdateProductDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ nullable: true, minLength: 2, maxLength: 32 })
  @Transform(normalizeNullableSku)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  sku?: string | null;

  @ApiPropertyOptional({ nullable: true, minLength: 1, maxLength: 64 })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9-]+$/)
  barcode?: string | null;
}
