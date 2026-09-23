import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ColorTheme } from '../../../generated/prisma/client';

export class UpdateColorThemeDto {
  @ApiProperty({ enum: ColorTheme, example: ColorTheme.OCEAN })
  @IsEnum(ColorTheme)
  colorTheme!: ColorTheme;
}
