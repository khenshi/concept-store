import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { SalePaymentMethod } from '../../../../generated/prisma/client';
import { trimRequiredString } from '../../products/dto/product-dto.transforms';
const lowerUuid = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() : value;

@ValidatorConstraint({ name: 'refundRestock', async: false })
class RefundRestock implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    return (
      typeof value === 'number' &&
      value <= (args.object as RefundLineDto).quantity
    );
  }
  defaultMessage() {
    return 'restockQuantity cannot exceed returned quantity';
  }
}
export class RefundLineDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(lowerUuid)
  @IsUUID('4')
  saleItemId!: string;
  @ApiProperty({ minimum: 1, maximum: 2147483647, type: 'integer' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 2147483647,
    default: 0,
    type: 'integer',
  })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  @Validate(RefundRestock)
  restockQuantity = 0;
}
@ValidatorConstraint({ name: 'refundPaymentFields', async: false })
class RefundPaymentFields implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as CreateRefundDto;
    return dto.paymentMethod === 'CASH'
      ? dto.paymentReference === undefined
      : typeof dto.paymentReference === 'string';
  }
  defaultMessage() {
    return 'CASH rejects paymentReference; manual GCASH/CARD require paymentReference';
  }
}
export class CreateRefundDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Reuse unchanged command ID for unknown/failed outcomes',
  })
  @Transform(lowerUuid)
  @IsUUID('4')
  requestId!: string;
  @ApiProperty({ type: [RefundLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: RefundLineDto) => item?.saleItemId)
  @ValidateNested({ each: true })
  @Type(() => RefundLineDto)
  items!: RefundLineDto[];
  @ApiProperty({ minLength: 2, maxLength: 500 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 500)
  reason!: string;
  @ApiProperty({
    enum: SalePaymentMethod,
    description:
      'Actual manually issued refund method; may differ from original sale',
  })
  @IsEnum(SalePaymentMethod)
  @Validate(RefundPaymentFields)
  paymentMethod!: SalePaymentMethod;
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 100,
    description: 'Manual GCASH/CARD reference only, unverified',
  })
  @ValidateIf((dto: CreateRefundDto) => dto.paymentMethod !== 'CASH')
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  paymentReference?: string;
  @ApiProperty({
    enum: [true],
    description:
      'Explicit attestation that the refund was issued; does not call a payment provider',
  })
  @IsBoolean()
  @Equals(true)
  refundConfirmed!: boolean;
}
export class RefundCommandQueryDto {}
