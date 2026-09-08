import type { RoleName } from '@prisma/client';
import type { DefaultSession } from 'next-auth';
import type { AdminCohortScope } from '@/lib/auth/scope';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roles: RoleName[];
      adminCohortScope: AdminCohortScope;
      locale: string;
    } & DefaultSession['user'];
  }

  interface User {
    roles?: RoleName[];
    adminCohortScope?: AdminCohortScope;
    locale?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    roles?: RoleName[];
    adminCohortScope?: AdminCohortScope;
    locale?: string;
  }
}
