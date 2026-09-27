import { z } from "zod";

const level = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const courseInputSchema = z.object({
  title: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(80),
  description: z.string().trim().min(10).max(12000),
  level,
  price: z.string().trim().max(12),
  originalPrice: z.string().trim().max(12),
  technologies: z.string().max(500),
  outcomes: z.string().max(8000),
  requirements: z.string().max(8000),
  featured: z.boolean(),
  status,
  currency: z.enum(["USD", "EGP"]),
  thumbnail: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || value.startsWith("https://"), { error: "Use an https image URL." }),
});

export const moduleTitleSchema = z.string().trim().min(2).max(140);
export const lessonTitleSchema = z.string().trim().min(2).max(140);

export const lessonInputSchema = z.object({
  title: lessonTitleSchema,
  slug: z.string().trim().min(1).max(80),
  description: z.string().trim().max(12000),
  minutes: z.coerce.number().int().min(0).max(600),
  seconds: z.coerce.number().int().min(0).max(59),
  videoUrl: z.string().trim().max(500),
  isPreview: z.boolean(),
});

export const resourceKindSchema = z.enum(["PDF", "SLIDES", "SOURCE", "EXERCISE", "LINK", "OTHER"]);

export const resourceSchema = z.object({
  title: z.string().trim().min(1).max(140),
  kind: resourceKindSchema,
  url: z
    .string()
    .trim()
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, { error: "Use an http or https URL." }),
});

export const enrollSchema = z.object({
  email: z.email(),
  courseId: z.string().trim().min(1),
});

export function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listFromCommas(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function centsFromDollars(value: string) {
  if (!value.trim()) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000) return null;
  return Math.round(amount * 100);
}
