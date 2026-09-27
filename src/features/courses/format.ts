import { CourseLevel } from "@prisma/client";

const levelLabels: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export function formatLevel(level: CourseLevel) {
  return levelLabels[level];
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function splitCourseTitle(title: string) {
  const index = title.indexOf(": ");
  if (index === -1) return { name: title, subtitle: null as string | null };
  return {
    name: title.slice(0, index),
    subtitle: title.slice(index + 2),
  };
}

export function formatDiscount(cents: number, currency = "USD") {
  return `−${formatPrice(cents, currency)}`;
}

export function formatPrice(cents: number, currency = "USD") {
  if (cents <= 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function lessonCount(
  modules: { lessons: unknown[] }[] | { _count: { lessons: number } }[],
) {
  return modules.reduce((total, module) => {
    if ("lessons" in module && Array.isArray(module.lessons)) {
      return total + module.lessons.length;
    }
    if ("_count" in module) return total + module._count.lessons;
    return total;
  }, 0);
}
