import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { InventoryPriceDto } from './inventory-price.dto';

export class CreateBranchInventoryDto extends InventoryPriceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    default: 5,
    description:
      'Per-branch low-stock threshold; zero disables low-stock warnings',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  lowStockThreshold?: number;
}
