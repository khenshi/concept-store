import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const jwtService = { signAsync: jest.fn() };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwtService.signAsync.mockResolvedValue('signed-token');
  });

  it('hashes a password and returns no password data when registering', async () => {
    prisma.user.create.mockImplementation(
      ({ data }: { data: { email: string; passwordHash: string } }) => {
        expect(data.email).toBe('owner@example.com');
        expect(data.passwordHash).not.toBe('correct horse battery staple');
        return { id: 'user-id', email: data.email };
      },
    );

    const result = await service.register({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });

    expect(result).toEqual({
      accessToken: 'signed-token',
      user: { id: 'user-id', email: 'owner@example.com' },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { email: 'owner@example.com' },
      { subject: 'user-id' },
    );
  });

  it('logs in a user with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'owner@example.com',
      passwordHash: await hash('correct horse battery staple', 4),
    });

    await expect(
      service.login({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      user: { id: 'user-id', email: 'owner@example.com' },
    });
  });

  it('uses the same generic error for an unknown email or wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'incorrect password',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('rejects a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'owner@example.com',
      passwordHash: await hash('correct horse battery staple', 4),
    });

    await expect(
      service.login({
        email: 'owner@example.com',
        password: 'incorrect password',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });
});
