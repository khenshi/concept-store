import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SpaceStatus } from '../../../../generated/prisma/client';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateSpaceTypeDto {
  @ApiProperty({ maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
export class CreateSpaceDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @ApiProperty({ maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  type!: string;
}
export class UpdateSpaceDto extends PartialType(CreateSpaceDto, {
  skipNullProperties: false,
}) {}
export class SpaceStatusDto {
  @ApiProperty({ enum: SpaceStatus }) @IsEnum(SpaceStatus) status!: SpaceStatus;
}
export class ListSpacesDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  type?: string;
  @ApiPropertyOptional({ enum: SpaceStatus })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;
  @ApiPropertyOptional({ enum: ['OCCUPIED', 'VACANT'] })
  @IsOptional()
  @IsEnum({ OCCUPIED: 'OCCUPIED', VACANT: 'VACANT' })
  occupancy?: 'OCCUPIED' | 'VACANT';
}
export class ListOccupanciesDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;
  @ApiPropertyOptional({ enum: ['CURRENT', 'HISTORY'] })
  @IsOptional()
  @IsEnum({ CURRENT: 'CURRENT', HISTORY: 'HISTORY' })
  view?: 'CURRENT' | 'HISTORY';
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive lower bound for occupancy-period overlap.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive upper bound for occupancy-period overlap.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}
export class AssignSpaceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') merchantId!: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Past or current start; defaults to action time. UTC timestamp required.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  startedAt?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Past end for recording closed history. Omit for current occupancy.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  endedAt?: string;
}
export class ReleaseSpaceDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Past or current end; defaults to action time.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  endedAt?: string;
}
