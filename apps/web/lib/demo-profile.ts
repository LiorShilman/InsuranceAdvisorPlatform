import { prisma } from "./prisma";

/**
 * This preview has no authentication system yet (§34's RBAC/session work
 * doesn't exist) — there is exactly one "demo" user/household/profile per
 * local database, identified by a fixed email, created on first use.
 * Real multi-user support needs an actual auth layer, not more of this
 * file. See docs/DECISIONS.md.
 */
const DEMO_USER_EMAIL = "demo-user@local.insurance-advisor";

export async function getOrCreateDemoClientProfile(): Promise<string> {
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });

  if (existingUser) {
    const existingProfile = await prisma.clientProfile.findFirst({ where: { userId: existingUser.id } });
    if (existingProfile) return existingProfile.id;
  }

  const user = existingUser ?? (await prisma.user.create({ data: { email: DEMO_USER_EMAIL, role: "client" } }));

  const household = await prisma.household.create({ data: { maritalStatus: "unknown" } });
  const person = await prisma.person.create({ data: { clientProfileId: "", isPrimaryApplicant: true, isSpouse: false } });
  const profile = await prisma.clientProfile.create({
    data: { userId: user.id, primaryPersonId: person.id, householdId: household.id },
  });
  // Person.clientProfileId couldn't be known until the profile existed — backfill it now.
  await prisma.person.update({ where: { id: person.id }, data: { clientProfileId: profile.id } });

  return profile.id;
}
