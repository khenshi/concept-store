import { PartialType } from '@nestjs/swagger';
import { CreateMerchantAgreementDto } from './create-merchant-agreement.dto';

export class UpdateMerchantAgreementDto extends PartialType(
  CreateMerchantAgreementDto,
) {}
