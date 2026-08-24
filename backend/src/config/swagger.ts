import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Concept Store Management System API')
    .setDescription(
      'API documentation for the multi-tenant Concept Store Management System.',
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
    .addTag('merchants', 'Organization merchant management')
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      customSiteTitle: 'Concept Store API Documentation',
      jsonDocumentUrl: OPENAPI_JSON_PATH,
      raw: ['json'],
    },
  );
}
