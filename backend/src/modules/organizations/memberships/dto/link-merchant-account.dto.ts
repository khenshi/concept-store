import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkMerchantAccountDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  merchantId!: string;
}
