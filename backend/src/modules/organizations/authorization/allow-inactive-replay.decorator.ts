import { SetMetadata } from '@nestjs/common';

export const ALLOW_INACTIVE_REPLAY = 'organizationAllowInactiveReplay';
export const AllowInactiveReplay = () =>
  SetMetadata(ALLOW_INACTIVE_REPLAY, true);
