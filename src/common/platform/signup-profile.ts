import type { PrismaService } from '../../integrations/database/prisma.service';
import { SIGNUP_ROLES } from '../../modules/auth/dto/register.dto';
import type { Prisma, MarketRole } from '../../generated/prisma/client';

export interface SignupIdentity {
  id: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
}

// Recover missing signup data only. Saved profile edits, permissions and consent
// remain authoritative; metadata never grants staff or logistics approval.
export async function syncSignupProfile(
  prisma: PrismaService,
  user: SignupIdentity,
  justVerified = false,
) {
  const metadata = user.user_metadata;
  if ((!justVerified && !user.email_confirmed_at) || !metadata) return;
  const clean = (key: string, min: number, max: number) => {
    const value = typeof metadata[key] === 'string' ? metadata[key].trim() : '';
    return value.length >= min && value.length <= max ? value : undefined;
  };
  const role = SIGNUP_ROLES.find((value) => value === metadata.market_role);
  const candidates = {
    firstName: clean('first_name', 1, 50),
    lastName: clean('last_name', 1, 50),
    displayName: clean('display_name', 1, 100),
    phone: clean('phone', 10, 16),
    city: clean('city', 2, 100),
  };
  if (candidates.phone && !/^\+?\d{10,15}$/.test(candidates.phone))
    candidates.phone = undefined;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${user.id}::uuid FOR UPDATE`;
    const profile = await tx.profile.findUniqueOrThrow({
      where: { id: user.id },
      include: { preferences: true },
    });
    const patch: Prisma.ProfileUpdateInput = {};
    for (const key of [
      'firstName',
      'lastName',
      'displayName',
      'phone',
      'city',
    ] as const)
      if (!profile[key]?.trim() && candidates[key])
        patch[key] = candidates[key];

    const preferences = profile.preferences;
    const chosenRole =
      preferences?.marketRole === 'none' && role
        ? role
        : preferences?.marketRole;
    const preferencePatch: Prisma.UserPreferencesUpdateInput = {};
    if (preferences?.marketRole === 'none' && role) {
      preferencePatch.marketRole = role as MarketRole;
      preferencePatch.activeMode =
        role === 'seller'
          ? 'seller'
          : role === 'buyer' || role === 'both'
            ? 'buyer'
            : null;
    }
    if (preferences && !preferences.akubin) preferencePatch.akubin = true;
    if (preferences && Object.keys(preferencePatch).length)
      await tx.userPreferences.update({
        where: { profileId: user.id },
        data: preferencePatch,
      });

    const completed = { ...profile, ...patch };
    if (
      !profile.profileCompleted &&
      typeof completed.firstName === 'string' &&
      completed.firstName.trim() &&
      typeof completed.lastName === 'string' &&
      completed.lastName.trim() &&
      typeof completed.displayName === 'string' &&
      completed.displayName.trim() &&
      typeof completed.phone === 'string' &&
      /^\+?\d{10,15}$/.test(completed.phone) &&
      typeof completed.city === 'string' &&
      completed.city.trim().length >= 2 &&
      profile.termsAcceptedAt &&
      chosenRole &&
      chosenRole !== 'none'
    ) {
      patch.profileCompleted = true;
      patch.onboardedAt = profile.onboardedAt ?? new Date();
    }
    if (Object.keys(patch).length)
      await tx.profile.update({ where: { id: user.id }, data: patch });
  });
}
