import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MerchantStatus } from '../../../../generated/prisma/client';
import { trimOptionalString } from './merchant-dto.transforms';

export class ListMerchantsQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive profile search',
    maxLength: 254,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ enum: MerchantStatus })
  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;
}
