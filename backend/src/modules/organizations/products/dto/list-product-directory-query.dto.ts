import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { ListProductsQueryDto } from './list-products-query.dto';

export class ListProductDirectoryQueryDto extends ListProductsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(214748364)
  page = 1;
}
