import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';
import { BranchStatus } from '../../../../generated/prisma/client';

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: BranchStatus, example: BranchStatus.INACTIVE })
  @IsEnum(BranchStatus)
  status!: BranchStatus;

  @ApiProperty({
    format: 'date-time',
    description: 'The updatedAt value read before opening the status dialog',
  })
  @IsDateString()
  expectedUpdatedAt!: string;
}
