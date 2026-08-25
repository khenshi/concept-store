import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class EndSpaceAssignmentDto {
  @ApiProperty({ format: 'date', example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate!: string;
}
