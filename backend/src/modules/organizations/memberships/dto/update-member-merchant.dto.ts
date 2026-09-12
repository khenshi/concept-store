import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateMemberMerchantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  merchantId!: string;
}

// ValidationPipe rejects all unknown fields on assignment commands.
export class EmptyAssignmentDto {}
