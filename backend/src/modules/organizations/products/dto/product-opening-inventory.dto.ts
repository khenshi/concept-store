import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { InventoryPriceDto } from '../../inventory/dto/inventory-price.dto';

export class ProductOpeningInventoryDto extends InventoryPriceDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Explicitly selected branch in this organization',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ minimum: 1, maximum: 2147483647, example: 10 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;
}
