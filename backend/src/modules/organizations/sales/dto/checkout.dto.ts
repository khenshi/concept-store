import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { trimRequiredString } from '../../products/dto/product-dto.transforms';

const normalizeUuid = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() : value;

export class CheckoutItemDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(normalizeUuid)
  @IsUUID('4')
  branchInventoryId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;

  @ApiProperty({
    type: String,
    example: '850.00',
    description: 'Reviewed positive branch price, not a price override',
  })
  @Transform(trimRequiredString)
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/)
  expectedUnitPrice!: string;
}

export class CheckoutDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Reuse unchanged command ID for failed or unknown outcomes',
  })
  @Transform(normalizeUuid)
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ type: [CheckoutItemDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: CheckoutItemDto) => item?.branchInventoryId)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty({ format: 'uuid' })
  @Transform(normalizeUuid)
  @IsUUID('4')
  paymentAccountId!: string;

  @ApiPropertyOptional({
    type: String,
    example: '1000.00',
    description:
      'Cash account only; at most 22 integer and two fractional digits',
  })
  @ValidateIf((dto: CheckoutDto) => dto.cashTender !== undefined)
  @Transform(trimRequiredString)
  @IsString()
  @Matches(/^\d{1,22}(?:\.\d{1,2})?$/)
  cashTender?: string;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 100,
    description:
      'According to account policy, manually recorded and unverified',
  })
  @ValidateIf((dto: CheckoutDto) => dto.paymentReference !== undefined)
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  paymentReference?: string;
}
