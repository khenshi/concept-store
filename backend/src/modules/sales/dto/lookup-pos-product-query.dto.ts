import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trimRequiredCode } from './pos-product-query.transforms';

export class LookupPosProductQueryDto {
  @ApiProperty({ description: 'Exact SKU or barcode', example: 'AMH-01' })
  @Transform(trimRequiredCode)
  @IsString()
  @Length(2, 64)
  code!: string;
}
