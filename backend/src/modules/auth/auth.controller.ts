import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_RATE_LIMITS } from '../../config/rate-limit';
import {
  AuthenticatedUserResponseDto,
  AuthResponseDto,
  ActiveSessionPageResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from './auth.guard';
import {
  AccountThrottle,
  AuthAccountThrottleGuard,
} from './auth-account-throttle.guard';
import { AuthService } from './auth.service';
import type {
  AuthResponse,
  AuthenticatedPrincipal,
  AuthenticatedUser,
  AuthenticatedSessionPrincipal,
  ActiveSessionPage,
} from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateColorThemeDto } from './dto/update-color-theme.dto';
import { RefreshCookieService } from './sessions/refresh-cookie.service';
import { SessionPageQueryDto } from './dto/session-page-query.dto';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshCookieService: RefreshCookieService,
  ) {}

  @Post('register')
  @Throttle({ default: AUTH_RATE_LIMITS.register })
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
  @Throttle({ default: AUTH_RATE_LIMITS.login })
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
  @Throttle({ default: AUTH_RATE_LIMITS.refresh })
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
  @Throttle({ default: AUTH_RATE_LIMITS.logout })
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

  @UseGuards(AuthGuard)
  @Patch('me/theme')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the authenticated user color theme' })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiBadRequestResponse({ description: 'Color theme is unsupported' })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing or invalid',
  })
  updateColorTheme(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpdateColorThemeDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.updateColorTheme(user.id, dto.colorTheme);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, AuthAccountThrottleGuard)
  @Throttle({ default: AUTH_RATE_LIMITS.changePassword })
  @AccountThrottle(AUTH_RATE_LIMITS.changePassword)
  @Post('change-password')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiNoContentResponse({
    description: 'Password changed and all refresh sessions revoked',
  })
  @ApiBadRequestResponse({ description: 'The new password is unchanged' })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto);
    this.refreshCookieService.clear(response);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, AuthAccountThrottleGuard)
  @Throttle({ default: AUTH_RATE_LIMITS.deleteAccount })
  @AccountThrottle(AUTH_RATE_LIMITS.deleteAccount)
  @Delete('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete the authenticated user account' })
  @ApiNoContentResponse({
    description: 'Account anonymized and access revoked',
  })
  @ApiConflictResponse({
    description: 'The user is the sole owner of an organization',
  })
  @ApiUnauthorizedResponse({ description: 'Password is incorrect' })
  async deleteCurrentUser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.deleteCurrentUser(user.id, dto.password);
    this.refreshCookieService.clear(response);
  }

  @UseGuards(AuthGuard)
  @Get('sessions')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the authenticated account active sessions' })
  @ApiOkResponse({ type: ActiveSessionPageResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Access token or session is invalid',
  })
  @ApiServiceUnavailableResponse({
    description: 'Authentication is temporarily unavailable',
  })
  listSessions(
    @CurrentUser() user: AuthenticatedSessionPrincipal,
    @Query() query: SessionPageQueryDto,
  ): Promise<ActiveSessionPage> {
    return this.authService.listSessions(user.id, user.sessionId, query.page);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Delete('sessions/:sessionId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke one session owned by the authenticated account',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Session not found' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedSessionPrincipal,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const normalizedId = sessionId.toLowerCase();
    await this.authService.revokeSession(user.id, normalizedId);
    if (normalizedId === user.sessionId)
      this.refreshCookieService.clear(response);
  }
}
