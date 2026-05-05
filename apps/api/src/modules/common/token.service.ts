import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthContext } from './auth.types';
import { SecretsService } from './secrets.service';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  roles: string[];
  orgId: string | null;
  orgCode: string | null;
};

@Injectable()
export class TokenService {
  constructor(@Inject(SecretsService) private readonly secretsService: SecretsService) {}

  private getAccessSecret(): string {
    return this.secretsService.getJwtSecrets().accessSecret;
  }

  private getRefreshSecret(): string {
    return this.secretsService.getJwtSecrets().refreshSecret;
  }

  private getAccessTtl(): string {
    return process.env.JWT_ACCESS_TTL || '15m';
  }

  private getRefreshTtlDays(): number {
    const configured = Number(process.env.JWT_REFRESH_TTL_DAYS || 7);
    return Number.isFinite(configured) && configured > 0 ? configured : 7;
  }

  signAccessToken(context: AuthContext): string {
    const payload: AccessTokenPayload = {
      sub: context.userId,
      email: context.email,
      roles: context.roles,
      orgId: context.organizationId,
      orgCode: context.organizationCode
    };

    const expiresIn = this.getAccessTtl() as jwt.SignOptions['expiresIn'];
    return jwt.sign(payload, this.getAccessSecret(), { expiresIn });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.getAccessSecret()) as AccessTokenPayload;
  }

  createRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = jwt.sign(
      {
        jti: randomBytes(16).toString('hex')
      },
      this.getRefreshSecret(),
      {
        expiresIn: `${this.getRefreshTtlDays()}d`
      }
    );

    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.getRefreshTtlDays() * 24 * 60 * 60 * 1000);

    return {
      token,
      tokenHash,
      expiresAt
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
