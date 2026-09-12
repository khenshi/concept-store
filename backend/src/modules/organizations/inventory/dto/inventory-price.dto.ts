import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class InventoryPriceDto {
  @ApiProperty({
    type: String,
    example: '925.50',
    description:
      'Positive PHP decimal string; at most 10 integer and 2 fractional digits',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/, {
    message:
      'sellingPrice must be a positive decimal string up to 9999999999.99 with at most two decimal places',
  })
  sellingPrice!: string;
}
