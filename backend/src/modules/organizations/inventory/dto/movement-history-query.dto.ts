import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const queryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class MovementHistoryQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @Transform(queryInteger)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Last movement ID from the preceding page',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;
}
