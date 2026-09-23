import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateColorThemeDto } from './update-color-theme.dto';

describe('UpdateColorThemeDto', () => {
  it('accepts only the supported theme values', async () => {
    const values = [
      'GRAPHITE',
      'OCEAN',
      'FOREST',
      'PLUM',
      'POLLUX_LIGHT',
      'SKYDASH_LIGHT',
      'STAR_ADMIN_LIGHT',
      'AZIA_LIGHT',
      'PURPLE_LIGHT',
      'PLUS_ADMIN_LIGHT',
      'BREEZE_LIGHT',
      'STELLAR_DARK',
      'CORONA_DARK',
      'JUSTDO_DARK',
      'SYPHER_LIGHT',
      'CREXTIO_WARM',
      'SBB_INDUSTRIAL',
      'WELLNESS_TEAL',
    ];
    for (const colorTheme of values) {
      expect(
        await validate(plainToInstance(UpdateColorThemeDto, { colorTheme })),
      ).toHaveLength(0);
    }
    const invalid = plainToInstance(UpdateColorThemeDto, {
      colorTheme: 'CUSTOM',
    });

    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
