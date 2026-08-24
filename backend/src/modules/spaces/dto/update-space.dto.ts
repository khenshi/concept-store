import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { SpaceStatus, SpaceType } from '../../../generated/prisma/client';
import {
  normalizeRequiredCode,
  trimNullableString,
  trimRequiredString,
} from './space-dto.transforms';

export class UpdateSpaceDto {
  @ApiPropertyOptional({ example: 'RACK-A01', minLength: 2, maxLength: 32 })
  @Transform(normalizeRequiredCode)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string;

  @ApiPropertyOptional({
    example: 'Front display rack',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ enum: SpaceType })
  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Required only when the resulting type is CUSTOM',
    minLength: 2,
    maxLength: 80,
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @Length(2, 80)
  customType?: string | null;

  @ApiPropertyOptional({ enum: SpaceStatus })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;
}
