import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthResponse, AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await hash(dto.password, PASSWORD_HASH_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash },
        select: { id: true, email: true },
      });

      return this.createAuthResponse(user);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResponse({ id: user.id, email: user.email });
  }

  private async createAuthResponse(
    user: AuthenticatedUser,
  ): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync(
      { email: user.email },
      { subject: user.id },
    );

    return { accessToken, user };
  }
}
