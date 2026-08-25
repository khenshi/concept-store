import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

export class CreateSpaceAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  merchantId!: string;

  @ApiProperty({ format: 'date', example: '2026-08-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use YYYY-MM-DD format',
  })
  startDate!: string;
}
