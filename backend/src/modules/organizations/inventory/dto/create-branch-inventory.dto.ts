import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { InventoryPriceDto } from './inventory-price.dto';

export class CreateBranchInventoryDto extends InventoryPriceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;
}
