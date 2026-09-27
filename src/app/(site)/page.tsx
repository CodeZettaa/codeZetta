import { Suspense } from "react";
import { CourseGridSkeleton } from "@/features/courses/components/course-grid-skeleton";
import { FeaturedCourses } from "@/features/marketing/featured-courses";
import { FinalCta } from "@/features/marketing/final-cta";
import { Hero } from "@/features/marketing/hero";
import { HowItWorks } from "@/features/marketing/how-it-works";
import { Instructor } from "@/features/marketing/instructor";
import { Journey } from "@/features/marketing/journey";
import { WhyCodeZetta } from "@/features/marketing/why";
import { getStudentDashboard } from "@/features/dashboard/queries";
import { getCurrentUser } from "@/server/authz";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  let continueHref: string | null = null;
  if (user) {
    const dashboard = await getStudentDashboard(user.id);
    continueHref = dashboard.continueTarget?.continueLesson
      ? `/learn/${dashboard.continueTarget.slug}/${dashboard.continueTarget.continueLesson.slug}`
      : "/dashboard";
  }

  return (
    <main>
      <Hero continueHref={continueHref} />
      <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8"><CourseGridSkeleton /></div>}>
        <FeaturedCourses />
      </Suspense>
      <WhyCodeZetta />
      <HowItWorks />
      <Instructor />
      <Journey />
      <FinalCta continueHref={continueHref} />
    </main>
  );
}
