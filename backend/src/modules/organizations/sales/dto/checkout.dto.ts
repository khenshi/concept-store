import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { SalePaymentMethod } from '../../../../generated/prisma/client';
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

@ValidatorConstraint({ name: 'checkoutPaymentFields', async: false })
class CheckoutPaymentFields implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as CheckoutDto;
    return dto.paymentMethod === SalePaymentMethod.CASH
      ? typeof dto.cashTender === 'string' && dto.paymentReference === undefined
      : dto.cashTender === undefined &&
          typeof dto.paymentReference === 'string';
  }
  defaultMessage() {
    return 'CASH requires cashTender only; GCASH/CARD require paymentReference only';
  }
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

  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  @Validate(CheckoutPaymentFields)
  paymentMethod!: SalePaymentMethod;

  @ApiPropertyOptional({
    type: String,
    example: '1000.00',
    description: 'CASH only; at most 22 integer and two fractional digits',
  })
  @ValidateIf(
    (dto: CheckoutDto) => dto.paymentMethod === SalePaymentMethod.CASH,
  )
  @Transform(trimRequiredString)
  @IsString()
  @Matches(/^\d{1,22}(?:\.\d{1,2})?$/)
  cashTender?: string;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 100,
    description: 'GCASH/CARD only, manually recorded and unverified',
  })
  @ValidateIf(
    (dto: CheckoutDto) => dto.paymentMethod !== SalePaymentMethod.CASH,
  )
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  paymentReference?: string;
}
