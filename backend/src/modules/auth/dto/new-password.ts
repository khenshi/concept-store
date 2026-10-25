import { BadRequestException } from '@nestjs/common';
import { length, registerDecorator } from 'class-validator';

export function isValidNewPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    length(value, 12, 128) &&
    Buffer.byteLength(value, 'utf8') <= 72
  );
}

export function assertNewPassword(value: unknown): asserts value is string {
  if (!isValidNewPassword(value)) {
    throw new BadRequestException(
      'New password must contain at least 12 characters and at most 72 UTF-8 bytes',
    );
  }
}

export function IsNewPassword(): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isNewPassword',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: {
        message:
          '$property must contain at least 12 characters and at most 72 UTF-8 bytes',
      },
      validator: { validate: isValidNewPassword },
    });
  };
}
