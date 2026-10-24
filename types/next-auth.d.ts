/**
 * types/next-auth.d.ts
 *
 * Module augmentation so `session.user.id` / `session.user.role` and
 * `token.role` are typed everywhere, instead of every call site casting
 * `session.user as { role?: string }` by hand.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "volunteer";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "volunteer";
  }
}

// `next-auth/jwt` re-exports its JWT type from `@auth/core/jwt` rather than
// declaring its own — augmenting only "next-auth/jwt" above doesn't merge
// into the interface Auth.js's internal callback types actually reference
// (this only surfaces under `next build`'s type-check, not `next dev`).
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "volunteer";
  }
}
