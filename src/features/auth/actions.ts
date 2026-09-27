"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/server/rate-limit";
import { clientAddress, safeCallbackPath } from "@/server/request";
import {
  fieldErrorsFrom,
  initialAuthState,
  loginSchema,
  registerSchema,
  type AuthFormState,
} from "@/features/auth/schemas";

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const address = await clientAddress();
  const limit = rateLimit(`login:${address}:${parsed.data.email}`, 8, 15 * 60 * 1000);
  if (!limit.ok) {
    return {
      fieldErrors: {},
      message: "Too many sign-in attempts. Try again in a few minutes.",
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackPath(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { fieldErrors: {}, message: "Invalid email or password." };
    }
    throw error;
  }

  return initialAuthState;
}

export async function registerAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const address = await clientAddress();
  const limit = rateLimit(`register:${address}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return {
      fieldErrors: {},
      message: "Too many accounts created from this network. Try again later.",
    };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  try {
    await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "STUDENT",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        fieldErrors: { email: "An account with this email already exists." },
      };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackPath(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        fieldErrors: {},
        message: "Account created. Sign in with your email and password.",
      };
    }
    throw error;
  }

  return initialAuthState;
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
