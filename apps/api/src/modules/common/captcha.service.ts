import { Injectable } from '@nestjs/common';

@Injectable()
export class CaptchaService {
  async verifyToken(token: string, ipAddress: string | null): Promise<boolean> {
    const verifyUrl = process.env.CAPTCHA_VERIFY_URL;
    const secret = process.env.CAPTCHA_SECRET;

    if (!verifyUrl || !secret) {
      return token.startsWith('dev-token-') && token.length >= 10;
    }

    try {
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          secret,
          token,
          remoteip: ipAddress
        })
      });

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean };
      return payload.success === true;
    } catch {
      return false;
    }
  }
}
