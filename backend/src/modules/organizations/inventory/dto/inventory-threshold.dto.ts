import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class InventoryThresholdDto {
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 2147483647 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  lowStockThreshold!: number;
}
