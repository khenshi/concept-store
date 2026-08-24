import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateMerchantBranchesDto {
  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    minItems: 1,
    description: 'Complete replacement list of branches for this merchant',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  branchIds!: string[];
}
