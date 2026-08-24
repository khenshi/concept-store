import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { SpaceStatus, SpaceType } from '../../../generated/prisma/client';
import {
  normalizeRequiredCode,
  trimOptionalString,
  trimRequiredString,
} from './space-dto.transforms';

export class CreateSpaceDto {
  @ApiProperty({ example: 'RACK-A01', minLength: 2, maxLength: 32 })
  @Transform(normalizeRequiredCode)
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code!: string;

  @ApiProperty({ example: 'Front display rack', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ enum: SpaceType, example: SpaceType.RACK })
  @IsEnum(SpaceType)
  type!: SpaceType;

  @ApiPropertyOptional({
    description: 'Required only when type is CUSTOM',
    example: 'Window bay',
    minLength: 2,
    maxLength: 80,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @Length(2, 80)
  customType?: string;

  @ApiPropertyOptional({ enum: SpaceStatus, default: SpaceStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;
}
