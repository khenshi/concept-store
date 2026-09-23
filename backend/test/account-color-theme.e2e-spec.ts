import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { RefreshCookieService } from '../src/modules/auth/sessions/refresh-cookie.service';

describe('Account color theme (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const userId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: userId,
    email: 'owner@example.com',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: null,
    colorTheme: 'OCEAN',
  };
  const authService = { updateColorTheme: jest.fn() };
  const prismaService = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: userId }),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'account-theme-e2e-test-secret' }),
      ],
      controllers: [AuthController],
      providers: [
        AuthGuard,
        { provide: PrismaService, useValue: prismaService },
        { provide: AuthService, useValue: authService },
        { provide: RefreshCookieService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('requires authentication and rejects unsupported theme values', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch('/auth/me/theme')
      .send({ colorTheme: 'OCEAN' })
      .expect(401);

    const token = jwtService.sign({ email: user.email }, { subject: userId });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch('/auth/me/theme')
      .set('Authorization', `Bearer ${token}`)
      .send({ colorTheme: 'CUSTOM' })
      .expect(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch('/auth/me/theme')
      .set('Authorization', `Bearer ${token}`)
      .send({ colorTheme: 'OCEAN', userId: 'someone-else' })
      .expect(400);
    expect(authService.updateColorTheme).not.toHaveBeenCalled();
  });

  it('updates the identity derived from the access token', async () => {
    authService.updateColorTheme.mockResolvedValue(user);
    const token = jwtService.sign({ email: user.email }, { subject: userId });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch('/auth/me/theme')
      .set('Authorization', `Bearer ${token}`)
      .send({ colorTheme: 'OCEAN' })
      .expect(200, user);
    expect(authService.updateColorTheme).toHaveBeenCalledWith(userId, 'OCEAN');
  });
});
