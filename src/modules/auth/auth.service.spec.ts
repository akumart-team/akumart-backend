import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { SupabaseService } from '../../integrations/supabase/supabase.service';
import type { PrismaService } from '../../integrations/database/prisma.service';

describe('AuthService password reset and logout', () => {
  const dto = { email: 'user@example.com', code: '123456', newPassword: 'new-password' };
  let service: AuthService;
  let verifyOtp: jest.Mock;
  let updateUserById: jest.Mock;
  let signOut: jest.Mock;

  beforeEach(() => {
    verifyOtp = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-id' }, session: { access_token: 'recovery-token' } },
      error: null,
    });
    updateUserById = jest.fn().mockResolvedValue({ error: null });
    signOut = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      client: () => ({ auth: { verifyOtp } }),
      admin: { auth: { admin: { updateUserById, signOut } } },
    };
    service = new AuthService(supabase as unknown as SupabaseService, {} as PrismaService);
  });

  it('rejects an invalid recovery code without changing the password', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'expired' } });
    await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('stops before revocation when the password update fails', async () => {
    updateUserById.mockResolvedValue({ error: { message: 'provider details' } });
    await expect(service.resetPassword(dto)).rejects.toThrow('Unable to update password');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('reports that the password changed when revocation fails', async () => {
    signOut.mockResolvedValue({ error: { message: 'unavailable' } });
    await expect(service.resetPassword(dto)).rejects.toThrow('Password updated, but existing sessions could not be revoked.');
    expect(updateUserById).toHaveBeenCalledWith('user-id', { password: dto.newPassword });
  });

  it('updates the password and requests global session revocation', async () => {
    await expect(service.resetPassword(dto)).resolves.toEqual({ message: 'Password updated. Please log in.' });
    expect(verifyOtp).toHaveBeenCalledWith({ email: dto.email, token: dto.code, type: 'recovery' });
    expect(updateUserById).toHaveBeenCalledWith('user-id', { password: dto.newPassword });
    expect(signOut).toHaveBeenCalledWith('recovery-token', 'global');
  });

  it('does not report logout success when revocation fails', async () => {
    signOut.mockResolvedValue({ error: { message: 'unavailable' } });
    await expect(service.logout('access-token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('requests revocation of the current session on logout', async () => {
    await expect(service.logout('access-token')).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith('access-token', 'local');
  });
});
