import { compare } from "bcryptjs";
import { Role } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { loginSchema } from "@/features/auth/schemas";

function isRole(value: unknown): value is Role {
  return value === Role.STUDENT || value === Role.ADMIN;
}

const DUMMY_HASH = "$2b$12$Z8Dp7xy7BPWj26xhtsPt8O0wf5z6niCVCiQwtzt6lZwQ7CHCm5T4u";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });

        const passwordHash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await compare(parsed.data.password, passwordHash);
        if (!user?.passwordHash || !valid || !user.email) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && typeof user.id === "string" && isRole(user.role)) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string" && isRole(token.role)) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
