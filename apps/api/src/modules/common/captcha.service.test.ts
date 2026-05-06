import { describe, expect, it } from 'vitest';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
  it('accepts dev token fallback when no provider env is configured', async () => {
    delete process.env.CAPTCHA_VERIFY_URL;
    delete process.env.CAPTCHA_SECRET;

    const service = new CaptchaService();
    await expect(service.verifyToken('dev-token-12345', '127.0.0.1')).resolves.toBe(true);
    await expect(service.verifyToken('short', '127.0.0.1')).resolves.toBe(false);
  });
});
