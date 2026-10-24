import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { MerchantBranchesController } from './merchant-branches.controller';
import { MerchantBranchesService } from './merchant-branches.service';

describe('Merchant branch OpenAPI pagination', () => {
  it('documents the fixed fifteen-row page on both association routes', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MerchantBranchesController],
      providers: [{ provide: MerchantBranchesService, useValue: {} }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = moduleRef.createNestApplication();
    try {
      await app.init();
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const schema =
        document.components?.schemas?.MerchantBranchPageResponseDto;
      if (!schema || '$ref' in schema)
        throw new Error('Expected an inline merchant branch page schema');
      expect(schema.properties?.limit).toMatchObject({ enum: [15] });
      for (const path of [
        '/organizations/{organizationId}/merchants/{merchantId}/branches',
        '/organizations/{organizationId}/branches/{branchId}/merchants',
      ])
        expect(document.paths[path]?.get?.responses['200']).toMatchObject({
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MerchantBranchPageResponseDto',
              },
            },
          },
        });
    } finally {
      await app.close();
    }
  });
});
