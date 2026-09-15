import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { consume, RULES } from "./rate-limit";

/**
 * A real bcrypt hash of a value nobody can supply, compared against when the
 * email does not exist. Without it, "no such user" returns in ~0ms while a
 * wrong password takes ~100ms, which is enough to enumerate who has an account
 * on a medical platform.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.ZxZ5Vv3cNTe/tQmVZQWxvQkXGhLxKTS";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // Throttle credential stuffing. Limited per-IP and per-account: the
        // per-account bucket matters because a botnet spreads across IPs.
        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined) ?? "";
        const ip = forwarded.split(",")[0].trim() || "unknown";
        if (!consume("login-ip", ip, RULES.login)) return null;
        if (!consume("login-account", email, RULES.login)) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          // Burn comparable time so a missing account is indistinguishable
          // from a wrong password.
          await bcrypt.compare(credentials.password, DUMMY_HASH);
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Sessions expire rather than living forever; the JWT is refreshed while the
  // user is active.
  //
  // The session cookie is deliberately left to NextAuth's defaults: httpOnly,
  // sameSite=lax, path=/, and the `__Secure-` prefix plus secure=true derived
  // from the NEXTAUTH_URL scheme. Pinning those to NODE_ENV instead breaks the
  // middleware, which resolves the cookie name from the scheme — the app would
  // write `__Secure-next-auth.session-token` while the guard looked for the
  // unprefixed name and redirected signed-in users to /login.
};
