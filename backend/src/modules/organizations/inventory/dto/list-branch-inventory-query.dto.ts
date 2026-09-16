import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { InventoryStockStatus } from '../inventory.types';
import { InventoryPageQueryDto } from './inventory-page-query.dto';

export class ListBranchInventoryQueryDto extends IntersectionType(
  ListProductsQueryDto,
  InventoryPageQueryDto,
) {
  @ApiPropertyOptional({ enum: InventoryStockStatus })
  @IsOptional()
  @IsEnum(InventoryStockStatus)
  stockStatus?: InventoryStockStatus;
}
