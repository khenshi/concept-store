import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { MerchantStatus } from '../../../generated/prisma/client';

export class UpdateMerchantStatusDto {
  @ApiProperty({ enum: MerchantStatus, example: MerchantStatus.INACTIVE })
  @IsEnum(MerchantStatus)
  status!: MerchantStatus;
}
