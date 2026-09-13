import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  trimOptionalString,
  trimRequiredString,
} from '../../products/dto/product-dto.transforms';

export class PosCatalogQueryDto {
  @ApiPropertyOptional({
    maxLength: 254,
    description:
      'Search name/SKU ignoring case, or case-sensitive barcode; at most 100 matches',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;
}

export class PosCodeQueryDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 64,
    description:
      'Exact SKU or barcode; barcode preserves case and leading zeroes',
  })
  @Transform(trimRequiredString)
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9-]+$/)
  code!: string;
}
