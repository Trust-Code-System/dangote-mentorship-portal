import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ADMIN_ROLES } from './roles';
import type { AdminCohortScope } from './scope';
import { verifyPassword } from './password';
import { authConfig } from './auth.config';
import { clientIpFromHeaders } from './rate-limit';
import { checkRateLimit } from './rate-limit-shared';

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface RoleGrants {
  roles: RoleName[];
  adminCohortScope: AdminCohortScope;
}

/**
 * Loads a user's role names plus the cross-cohort reach their admin grants confer
 * (m2-audit-findings H1). A null-cohort admin grant (the global Super Admin) means
 * every cohort ('ALL'); otherwise the admin is confined to the specific cohorts
 * they were granted in. Non-admins get an empty scope (never consulted — admin
 * reads are requireRole-gated regardless).
 */
async function loadRoleGrants(userId: string): Promise<RoleGrants> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, deletedAt: null },
    include: { role: true },
  });
  // De-duplicate role names across cohort-scoped grants.
  const roles = Array.from(new Set(userRoles.map((ur) => ur.role.name)));

  const adminGrants = userRoles.filter((ur) => ADMIN_ROLES.includes(ur.role.name));
  const hasGlobalGrant = adminGrants.some((ur) => ur.cohortId === null);
  const adminCohortScope: AdminCohortScope = hasGlobalGrant
    ? 'ALL'
    : Array.from(
        new Set(adminGrants.map((ur) => ur.cohortId).filter((c): c is string => c !== null)),
      );

  return { roles, adminCohortScope };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // Allow Entra ID SSO accounts to link to an existing email/password user
  // record that an admin created ahead of time (CLAUDE.md §2).
  providers: [
    ...authConfig.providers,
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const ip = clientIpFromHeaders(
          request.headers.get('x-forwarded-for'),
          request.headers.get('x-real-ip'),
        );
        const limit = await checkRateLimit(
          `login:${ip}:${email.toLowerCase()}`,
          LOGIN_LIMIT,
          LOGIN_WINDOW_MS,
        );
        if (!limit.ok) return null;

        const user = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), deletedAt: null, isActive: true },
        });
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        const { roles, adminCohortScope } = await loadRoleGrants(user.id);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          roles,
          adminCohortScope,
          locale: user.locale,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Node-runtime: enrich the JWT with roles + id + locale at sign-in. On
    // subsequent (edge) requests this callback isn't re-run with `user`, so the
    // values persist without hitting the database.
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Credentials sign-in already carried roles + scope; SSO sign-in did not.
        const u = user as {
          roles?: RoleName[];
          adminCohortScope?: AdminCohortScope;
          locale?: string;
        };
        if (u.roles && u.adminCohortScope !== undefined) {
          token.roles = u.roles;
          token.adminCohortScope = u.adminCohortScope;
        } else {
          const grants = await loadRoleGrants(user.id as string);
          token.roles = grants.roles;
          token.adminCohortScope = grants.adminCohortScope;
        }
        token.locale = u.locale ?? 'EN';
      }
      if (trigger === 'update' && token.sub) {
        const grants = await loadRoleGrants(token.sub);
        token.roles = grants.roles;
        token.adminCohortScope = grants.adminCohortScope;
      }
      return token;
    },
  },
});
