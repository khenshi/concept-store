import { ApiProperty } from '@nestjs/swagger';

export class MemberBranchResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: String, nullable: true })
  code!: string | null;
}

export class MemberMerchantResponse {
  @ApiProperty({ format: 'uuid' })
  merchantId!: string;
}
