import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BranchStatus } from '../../../../generated/prisma/client';

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: BranchStatus, example: BranchStatus.INACTIVE })
  @IsEnum(BranchStatus)
  status!: BranchStatus;
}
