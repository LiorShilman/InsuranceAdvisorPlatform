import { prisma } from "./prisma";

/**
 * Replaces `lib/demo-profile.ts`'s single hardcoded demo user — every
 * real, authenticated user now gets their own `ClientProfile`, created on
 * first use. Same household/person bootstrap logic as the old demo
 * profile, just keyed by the real signed-in user's id instead of a fixed
 * email. See docs/DECISIONS.md.
 */
export type ClientProfileInfo = { clientProfileId: string; primaryPersonId: string };

export async function getOrCreateClientProfileForUser(userId: string): Promise<ClientProfileInfo> {
  const existingProfile = await prisma.clientProfile.findFirst({ where: { userId } });
  if (existingProfile) return { clientProfileId: existingProfile.id, primaryPersonId: existingProfile.primaryPersonId };

  const household = await prisma.household.create({ data: { maritalStatus: "unknown" } });
  const person = await prisma.person.create({ data: { clientProfileId: "", isPrimaryApplicant: true, isSpouse: false } });
  const profile = await prisma.clientProfile.create({
    data: { userId, primaryPersonId: person.id, householdId: household.id },
  });
  // Person.clientProfileId couldn't be known until the profile existed — backfill it now.
  await prisma.person.update({ where: { id: person.id }, data: { clientProfileId: profile.id } });

  return { clientProfileId: profile.id, primaryPersonId: person.id };
}

/** Ownership check — a clientProfileId in a request body/query is client-supplied, so every API route that accepts one must confirm it actually belongs to the requesting session's user before reading or writing anything through it. */
export async function clientProfileBelongsToUser(clientProfileId: string, userId: string): Promise<boolean> {
  const profile = await prisma.clientProfile.findUnique({ where: { id: clientProfileId } });
  return profile?.userId === userId;
}
