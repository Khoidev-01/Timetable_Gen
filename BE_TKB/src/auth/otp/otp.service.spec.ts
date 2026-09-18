import { BadRequestException } from '@nestjs/common';

jest.mock('better-auth/api', () => ({ APIError: class APIError extends Error {} }));
jest.mock('./better-auth.config', () => ({ createBetterAuth: jest.fn() }));

import { OtpService } from './otp.service';

type OtpServiceInternals = {
  send(email: string): Promise<void>;
  redis: {
    ttl: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    decr: jest.Mock;
  };
  auth: { api: { createVerificationOTP: jest.Mock } };
  mail: { sendOtp: jest.Mock };
  logger: { error: jest.Mock };
};

describe('OtpService email delivery', () => {
  it('releases rate-limit reservations when SMTP delivery fails', async () => {
    const redis = {
      ttl: jest.fn().mockResolvedValue(-2),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(0),
    };
    const service = Object.assign(Object.create(OtpService.prototype), {
      redis,
      auth: { api: { createVerificationOTP: jest.fn().mockResolvedValue('123456') } },
      mail: { sendOtp: jest.fn().mockRejectedValue(new Error('530 authentication Required')) },
      logger: { error: jest.fn() },
    }) as OtpServiceInternals;

    await expect(service.send('Teacher@Example.com')).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.del).toHaveBeenCalledWith('otp:cooldown:teacher@example.com');
    expect(redis.decr).toHaveBeenCalledWith('otp:hourly:teacher@example.com');
  });
});
