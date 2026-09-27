import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email." })),
  password: z.string().min(1, { error: "Enter your password." }).max(72),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(80, { error: "Name must be 80 characters or fewer." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email." })),
  password: z
    .string()
    .min(10, { error: "Use at least 10 characters." })
    .max(72, { error: "Password must be 72 characters or fewer." })
    .regex(/[A-Za-z]/, { error: "Include a letter." })
    .regex(/[0-9]/, { error: "Include a number." }),
});

export type AuthFormState = {
  message?: string;
  fieldErrors: {
    name?: string;
    email?: string;
    password?: string;
  };
};

export const initialAuthState: AuthFormState = { fieldErrors: {} };

export function fieldErrorsFrom(error: z.ZodError) {
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "email" || key === "password") {
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
