import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { ListMerchantsQueryDto } from './list-merchants-query.dto';

export class ListMerchantDirectoryQueryDto extends ListMerchantsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(214748364)
  page = 1;
}
