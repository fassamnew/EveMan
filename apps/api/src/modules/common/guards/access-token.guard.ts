import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../token.service';
import type { RequestWithAuth } from '../request-with-auth';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = this.tokenService.verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles as never,
      organizationId: payload.orgId,
      organizationCode: payload.orgCode
    };

    return true;
  }
}
