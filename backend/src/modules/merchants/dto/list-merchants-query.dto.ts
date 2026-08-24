import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MerchantStatus } from '../../../generated/prisma/client';
import { trimOptionalSearch } from './merchant-dto.transforms';

export class ListMerchantsQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive match across name, code, and contact fields',
    maxLength: 120,
  })
  @Transform(trimOptionalSearch)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: MerchantStatus })
  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;
}
