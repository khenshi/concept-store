import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { InventoryStockStatus } from '../inventory.types';

export class ListBranchInventoryQueryDto extends ListProductsQueryDto {
  @ApiPropertyOptional({ enum: InventoryStockStatus })
  @IsOptional()
  @IsEnum(InventoryStockStatus)
  stockStatus?: InventoryStockStatus;
}
