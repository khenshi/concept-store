import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedUserResponseDto,
  AuthResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type {
  AuthResponse,
  AuthenticatedPrincipal,
  AuthenticatedUser,
} from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RefreshCookieService } from './sessions/refresh-cookie.service';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshCookieService: RefreshCookieService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register an account and start a session' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'The email is already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(dto);
    this.refreshCookieService.write(response, result.refreshSession);
    return result.response;
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Log in and start a session' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto);
    this.refreshCookieService.write(response, result.refreshSession);
    return result.response;
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiCookieAuth('concept_store_refresh')
  @ApiOperation({
    summary: 'Rotate the refresh session and issue an access token',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh session is missing or invalid',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.refresh(
      this.refreshCookieService.read(request),
    );
    this.refreshCookieService.write(response, result.refreshSession);
    return result.response;
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiCookieAuth('concept_store_refresh')
  @ApiOperation({ summary: 'Revoke the refresh session' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.refreshCookieService.read(request));
    this.refreshCookieService.clear(response);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return the authenticated user' })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing or invalid',
  })
  getCurrentUser(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<AuthenticatedUser> {
    return this.authService.getCurrentUser(user.id);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing or invalid',
  })
  updateCurrentUser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.updateCurrentUser(user.id, dto);
  }
}
