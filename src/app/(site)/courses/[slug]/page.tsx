import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { instructor } from "@/features/marketing/content";
import { Curriculum } from "@/features/courses/components/curriculum";
import { EnrollPanel } from "@/features/courses/components/enroll-panel";
import { audienceFor, courseFaq } from "@/features/courses/copy";
import { formatDuration, formatLevel, lessonCount, splitCourseTitle } from "@/features/courses/format";
import { getEnrollmentStatus, getPublishedCourse } from "@/features/courses/queries";
import { publicCoursePrice } from "@/features/commerce/offers";
import { hasOpenCheckout } from "@/features/commerce/queries";
import { isMockProviderEnabled } from "@/features/commerce/provider";
import { deriveCourseCallToAction } from "@/features/enrollment/access";
import { getContinueLearningTarget } from "@/features/enrollment/continue";
import { CourseReviews } from "@/features/reviews/components/course-reviews";
import { getCurrentUser } from "@/server/authz";
import { isDevEnrollmentEnabled } from "@/server/dev-enrollment";

export const dynamic = "force-dynamic";

type CoursePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enrolled?: string; access?: string; reviewSort?: string; reviewPage?: string }>;
};

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const course = await getPublishedCourse(slug, viewer?.role === "ADMIN");
  if (!course) return { title: "Course" };
  return {
    title: course.title,
    description: course.description.slice(0, 160),
  };
}

export default async function CoursePage({ params, searchParams }: CoursePageProps) {
  const { slug } = await params;
  const { enrolled: enrolledFlag, access: accessFlag, reviewSort = "newest", reviewPage = "0" } = await searchParams;
  const viewer = await getCurrentUser();
  const course = await getPublishedCourse(slug, viewer?.role === "ADMIN");
  if (!course) notFound();
  const progress =
    viewer && viewer.role !== "ADMIN" ? await getContinueLearningTarget(viewer.id, course.id) : null;
  const firstLesson = course.modules.flatMap((module) => module.lessons)[0];
  const lessonHref = progress?.lesson
    ? `/learn/${course.slug}/${progress.lesson.slug}`
    : firstLesson
      ? `/learn/${course.slug}/${firstLesson.slug}`
      : `/courses/${course.slug}`;
  const checkoutPath = `/checkout/${course.slug}`;
  const pendingPayment =
    viewer && viewer.role !== "ADMIN" && !progress ? await hasOpenCheckout(viewer.id, course.id) : false;
  const access = deriveCourseCallToAction({
    role: viewer?.role ?? null,
    enrolled: Boolean(progress),
    started: Boolean(progress?.started),
    percent: progress?.percent ?? 0,
    lessonHref,
    loginHref: `/login?callbackUrl=${encodeURIComponent(checkoutPath)}`,
    editHref: `/admin/courses/${course.id}`,
    courseId: course.id,
    courseSlug: course.slug,
    priceCents: course.priceCents,
    devEnrollment: isDevEnrollmentEnabled(),
    paymentsAvailable: isMockProviderEnabled(),
    pendingPayment,
    checkoutHref: checkoutPath,
    registerHref: `/register?callbackUrl=${encodeURIComponent(checkoutPath)}`,
  });
  const priced = await publicCoursePrice(course);
  const offerPrice = {
    totalCents: priced.totalCents,
    discountCents: priced.discountCents,
    offerName: priced.promotionName,
    endsAt: priced.promotionEndsAt?.toISOString() ?? null,
  };
  const { name, subtitle } = splitCourseTitle(course.title);
  const lessons = lessonCount(course.modules);
  const paragraphs = course.description.split(/\n\n+/).filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
      {course.status !== "PUBLISHED" ? (
        <p className="mb-6 rounded-xl border border-primary/40 px-4 py-3 text-sm text-primary">
          Draft preview. Students cannot see this course until it is published.
        </p>
      ) : null}
      {enrolledFlag === "1" && progress ? (
        <p className="mb-6 rounded-xl border border-primary/40 px-4 py-3 text-sm" role="status">
          You&apos;re enrolled. Your course is ready to start.
        </p>
      ) : null}
      {accessFlag === "denied" && !progress ? (
        <AccessDenied courseId={course.id} userId={viewer?.id ?? null} />
      ) : null}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article>
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
            {formatLevel(course.level)}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight text-balance md:text-5xl">{name}</h1>
          {subtitle ? <p className="mt-3 text-lg text-muted-foreground">{subtitle}</p> : null}
          <p className="mt-4 text-sm text-muted-foreground">
            {instructor.name} · {course.modules.length} modules · {formatDuration(course.durationSeconds)} ·{" "}
            {course.projects.length} projects · {lessons} lessons
          </p>
          <div className="mt-8 lg:hidden">
            <EnrollPanel course={course} access={access} price={offerPrice} />
          </div>
          <div className="mt-10 space-y-4 text-base leading-7 text-muted-foreground">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section className="mt-14">
            <h2 className="text-xl font-medium">What you&apos;ll learn</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-3 text-sm leading-6">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-medium">Curriculum</h2>
            <div className="mt-4">
              <Curriculum courseSlug={course.slug} modules={course.modules} />
            </div>
          </section>

          {course.projects.length > 0 ? (
            <section className="mt-14">
              <h2 className="text-xl font-medium">Projects you&apos;ll build</h2>
              <div className="mt-4 grid gap-4">
                {course.projects.map((project, index) => (
                  <article key={project.id} className="rounded-2xl border border-border p-5">
                    <p className="font-mono text-xs text-muted-foreground">
                      Project {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 text-base font-medium">{project.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{project.description}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-14">
            <h2 className="text-xl font-medium">Who this course is for</h2>
            <ul className="mt-4 space-y-3">
              {audienceFor(course.level, course.technologies).map((item) => (
                <li key={item} className="text-sm leading-6 text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-medium">Requirements</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
              {course.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-medium">Instructor</h2>
            <p className="mt-3 text-base font-medium">{instructor.name}</p>
            <p className="text-sm text-primary">{instructor.title}</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{instructor.summary}</p>
          </section>

          <CourseReviews
            courseId={course.id}
            courseSlug={course.slug}
            courseTitle={course.title}
            userId={viewer && viewer.role !== "ADMIN" ? viewer.id : null}
            sort={reviewSort}
            page={Number.isInteger(Number(reviewPage)) && Number(reviewPage) > 0 ? Number(reviewPage) : 0}
          />

          <section className="mt-14">
            <h2 className="text-xl font-medium">FAQ</h2>
            <div className="mt-4 divide-y divide-border border-y border-border">
              {courseFaq.map((item) => (
                <details key={item.question} className="group py-4">
                  <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {course.resources.length > 0 ? (
            <section className="mt-14">
              <h2 className="text-xl font-medium">References</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {course.resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      className="text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {resource.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <EnrollPanel course={course} access={access} price={offerPrice} />
        </aside>
      </div>
    </main>
  );
}

async function AccessDenied({ courseId, userId }: { courseId: string; userId: string | null }) {
  const status = userId ? await getEnrollmentStatus(userId, courseId) : null;
  return (
    <p className="mb-6 rounded-xl border border-border px-4 py-3 text-sm" role="status">
      {status === "CANCELLED"
        ? "You no longer have access to this course."
        : "You don't have access to this course."}
    </p>
  );
}
