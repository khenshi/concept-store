import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MerchantReceivableStatus } from '../../../generated/prisma/client';

export class ListMerchantReceivablesQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;

  @ApiPropertyOptional({ enum: MerchantReceivableStatus })
  @IsOptional()
  @IsEnum(MerchantReceivableStatus)
  status?: MerchantReceivableStatus;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
