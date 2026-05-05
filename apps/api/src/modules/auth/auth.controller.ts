import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { PasswordResetInitiateDto } from './dto/password-reset-initiate.dto';
import type { RequestWithAuth } from '../common/request-with-auth';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: RequestWithAuth) {
    return this.authService.login(dto, req);
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: RequestWithAuth) {
    return this.authService.refreshToken(dto.refreshToken, req);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: LogoutDto, @Req() req: RequestWithAuth): Promise<void> {
    await this.authService.logout(dto.refreshToken, req);
  }

  @HttpCode(202)
  @UseGuards(AuthRateLimitGuard)
  @Post('password-reset/initiate')
  async initiatePasswordReset(
    @Body() dto: PasswordResetInitiateDto,
    @Req() req: RequestWithAuth
  ): Promise<{ accepted: true }> {
    await this.authService.initiatePasswordReset(dto.email, req);
    return { accepted: true };
  }
}
