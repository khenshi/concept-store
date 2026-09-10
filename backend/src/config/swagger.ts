import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Kapwesto API')
    .setDescription(
      'API documentation for the multi-tenant Kapwesto concept store management system.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth('concept_store_refresh', {
      type: 'apiKey',
      in: 'cookie',
    })
    .addTag('health', 'Service health')
    .addTag('authentication', 'Account and session operations')
    .addTag('organizations', 'Organization access')
    .addTag('organization members', 'Organization membership and roles')
    .addTag('branches', 'Organization branch operations')
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      customSiteTitle: 'Kapwesto API Documentation',
      jsonDocumentUrl: OPENAPI_JSON_PATH,
      raw: ['json'],
    },
  );
}
