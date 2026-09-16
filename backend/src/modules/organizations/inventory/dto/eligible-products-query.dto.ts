import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimOptionalString } from '../../products/dto/product-dto.transforms';
import { InventoryPageQueryDto } from './inventory-page-query.dto';

export class EligibleProductsQueryDto extends InventoryPageQueryDto {
  @ApiPropertyOptional({
    maxLength: 254,
    description: 'Name/SKU insensitive search; barcode case-sensitive search',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;
}
