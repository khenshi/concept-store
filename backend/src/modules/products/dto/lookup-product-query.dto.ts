import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trimRequiredString } from './product-dto.transforms';

export class LookupProductQueryDto {
  @ApiProperty({ description: 'Exact SKU or barcode', example: 'AMH-01' })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 64)
  code!: string;
}
