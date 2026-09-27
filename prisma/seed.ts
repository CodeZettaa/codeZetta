import { hash } from "bcryptjs";
import { PrismaClient, type CourseLevel, type CourseStatus } from "@prisma/client";

const db = new PrismaClient();

type LessonSeed = {
  title: string;
  description: string;
  durationSeconds: number;
  isPreview?: boolean;
};

type ModuleSeed = {
  title: string;
  description: string;
  lessons: LessonSeed[];
};

type CourseSeed = {
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  featured: boolean;
  priceCents: number;
  originalPriceCents?: number;
  level: CourseLevel;
  technologies: string[];
  outcomes: string[];
  requirements: string[];
  modules: ModuleSeed[];
  projects: { title: string; description: string }[];
  resources: { title: string; url: string }[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const courses: CourseSeed[] = [
  {
    title: "Angular Signals: Think Like the Angular Team",
    slug: "angular-signals",
    description:
      "A course about how Angular's reactivity model actually works. You will trace dependency graphs, decide what belongs in a signal, a computed, or an effect, and build features the way the framework expects you to think.\n\nThis is not a tour of syntax. Each module asks you to explain why a piece of state lives where it does, then prove it in a project.",
    status: "PUBLISHED",
    featured: true,
    priceCents: 12900,
    originalPriceCents: 17900,
    level: "ADVANCED",
    technologies: ["Angular", "TypeScript", "RxJS", "Signals"],
    outcomes: [
      "Explain fine-grained reactivity and how a dependency graph is built",
      "Model UI state with signal, computed, and effect without mixing their jobs",
      "Handle async work with resources and a clear loading and error model",
      "Interoperate with RxJS at a boundary instead of converting everything",
      "Build a feature whose source of truth is signals",
    ],
    requirements: [
      "Comfortable reading and writing TypeScript",
      "Built at least one Angular application",
      "Familiar with components, templates, and dependency injection",
    ],
    resources: [
      {
        title: "Angular signals guide",
        url: "https://angular.dev/guide/signals",
      },
    ],
    projects: [
      {
        title: "Signal-driven task board",
        description:
          "A board whose filters, selection, and derived counts come from signals. No manual subscription bookkeeping.",
      },
      {
        title: "Resource-backed settings panel",
        description:
          "Load, refresh, and surface errors for a settings resource without hiding the request identity.",
      },
      {
        title: "RxJS boundary migration",
        description:
          "Take an existing observable-heavy component and draw a clean line between the stream and the signal graph.",
      },
    ],
    modules: [
      {
        title: "Reactivity Fundamentals",
        description: "What changes, what depends on it, and why that distinction matters.",
        lessons: [
          {
            title: "What is Reactivity",
            description: "A working definition of reactivity that is useful in Angular, not just in a diagram.",
            durationSeconds: 14 * 60,
            isPreview: true,
          },
          {
            title: "Broad vs Fine-Grained",
            description: "Why notifying a whole component tree is a different system from notifying a producer.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Dependency Graph",
            description: "How a read during a computation becomes an edge, and what happens when that edge goes stale.",
            durationSeconds: 18 * 60,
          },
        ],
      },
      {
        title: "Signals Fundamentals",
        description: "The writable unit of state, and the mistakes that make it lie.",
        lessons: [
          {
            title: "signal()",
            description: "Creating, reading, and writing a signal, including what a write does to consumers.",
            durationSeconds: 15 * 60,
          },
          {
            title: "Objects",
            description: "How object identity and mutation interact with a signal that holds a structure.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Arrays",
            description: "Updating collections without pretending the array mutated itself into a new value.",
            durationSeconds: 14 * 60,
          },
          {
            title: "Common Mistakes",
            description: "Reads outside a reactive context, accidental copies, and state that should not be a signal.",
            durationSeconds: 18 * 60,
          },
        ],
      },
      {
        title: "Computed",
        description: "Derived state that stays cheap because it remembers its inputs.",
        lessons: [
          {
            title: "Why computed exists",
            description: "The difference between a function you call and a value the graph keeps current.",
            durationSeconds: 12 * 60,
          },
          {
            title: "Derived state",
            description: "Modeling filters, counts, and view models as computations instead of stored copies.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Reading signals inside computed",
            description: "Which reads are tracked, and how a conditional read changes the graph.",
            durationSeconds: 15 * 60,
          },
        ],
      },
      {
        title: "Effects",
        description: "Side effects at the edge of the graph, used rarely and on purpose.",
        lessons: [
          {
            title: "Effect timing",
            description: "When an effect runs relative to rendering, and why that order matters.",
            durationSeconds: 14 * 60,
          },
          {
            title: "When not to use effects",
            description: "State that belongs in computed, and writes that create a loop.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Cleanup",
            description: "Subscriptions, timers, and DOM work that must end when the effect re-runs.",
            durationSeconds: 13 * 60,
          },
        ],
      },
      {
        title: "Async Reactivity & Resources",
        description: "Async work as part of the graph, with loading and error as data.",
        lessons: [
          {
            title: "Resource basics",
            description: "A resource as a signal of a request, not a promise hidden in a component.",
            durationSeconds: 18 * 60,
          },
          {
            title: "Loading and error states",
            description: "Modeling the states a screen must render without boolean flags that drift apart.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Request identity",
            description: "What happens when inputs change before the previous request finishes.",
            durationSeconds: 17 * 60,
          },
        ],
      },
      {
        title: "RxJS Interoperability",
        description: "Keep streams where streams are the right tool. Cross the boundary deliberately.",
        lessons: [
          {
            title: "toSignal and toObservable",
            description: "The two conversion points and the lifetime each one implies.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Bridging streams",
            description: "A practical bridge from an existing observable service into a signal-based view.",
            durationSeconds: 18 * 60,
          },
          {
            title: "Choosing a boundary",
            description: "How to decide which side owns a piece of state so the conversion does not spread.",
            durationSeconds: 15 * 60,
          },
        ],
      },
      {
        title: "Final Projects",
        description: "Apply the model to features with real constraints.",
        lessons: [
          {
            title: "Build a signal-driven store",
            description: "A small store for the task board, with derived views and no extra library.",
            durationSeconds: 28 * 60,
          },
          {
            title: "Migrate a component off manual subscriptions",
            description: "Replace a subscribe-in-ngOnInit component with a graph you can explain.",
            durationSeconds: 26 * 60,
          },
        ],
      },
    ],
  },
  {
    title: "JavaScript: Understand the Engine",
    slug: "javascript-the-engine",
    description:
      "JavaScript for people who already write it. Scope, objects, the event loop, and the browser behavior that decides how a frontend system feels under real work.\n\nYou will leave able to predict what a piece of code does, not just recognize the syntax.",
    status: "PUBLISHED",
    featured: true,
    priceCents: 7900,
    level: "INTERMEDIATE",
    technologies: ["JavaScript", "TypeScript", "Browser"],
    outcomes: [
      "Predict scope, closure, and this without guessing",
      "Explain the event loop in terms of tasks and microtasks",
      "Choose object and array shapes for the behavior you actually need",
      "Debug timing bugs that come from the browser, not from a framework",
    ],
    requirements: [
      "You write JavaScript or TypeScript regularly",
      "You have built a small frontend project",
    ],
    resources: [],
    projects: [
      {
        title: "Event-loop trace",
        description: "A small instrumented page that makes task and microtask order visible.",
      },
    ],
    modules: [
      {
        title: "Execution Model",
        description: "How a script actually runs.",
        lessons: [
          {
            title: "Scope and closures",
            description: "What a function captures, and what it does not.",
            durationSeconds: 18 * 60,
            isPreview: true,
          },
          {
            title: "this and call sites",
            description: "Why this changes, and how to stop being surprised by it.",
            durationSeconds: 16 * 60,
          },
        ],
      },
      {
        title: "The Event Loop",
        description: "Tasks, microtasks, and rendering.",
        lessons: [
          {
            title: "Tasks and microtasks",
            description: "The queue order that makes promises and timers behave the way they do.",
            durationSeconds: 20 * 60,
          },
          {
            title: "Rendering checkpoints",
            description: "Where the browser paints relative to your JavaScript.",
            durationSeconds: 14 * 60,
          },
        ],
      },
      {
        title: "Data and Objects",
        description: "Structures that match the behavior you want.",
        lessons: [
          {
            title: "Objects, maps, and identity",
            description: "When a plain object is the wrong collection.",
            durationSeconds: 16 * 60,
          },
          {
            title: "Copying versus mutating",
            description: "Shallow copies, shared references, and bugs that look like UI bugs.",
            durationSeconds: 15 * 60,
          },
        ],
      },
    ],
  },
  {
    title: "Production Angular Architecture",
    slug: "production-angular-architecture",
    description:
      "A draft course on feature boundaries, state ownership, and how an Angular app stays changeable after the first release.",
    status: "DRAFT",
    featured: false,
    priceCents: 14900,
    level: "ADVANCED",
    technologies: ["Angular", "TypeScript"],
    outcomes: ["Draw feature boundaries that survive a second team"],
    requirements: ["Shipped an Angular application"],
    resources: [],
    projects: [],
    modules: [
      {
        title: "Boundaries",
        description: "Where a feature starts and ends.",
        lessons: [
          {
            title: "Feature folders that mean something",
            description: "A folder structure that follows ownership, not file type.",
            durationSeconds: 20 * 60,
          },
        ],
      },
    ],
  },
];

async function seedCourse(course: CourseSeed) {
  await db.course.deleteMany({ where: { slug: course.slug } });

  const durationSeconds = course.modules
    .flatMap((module) => module.lessons)
    .reduce((total, lesson) => total + lesson.durationSeconds, 0);

  const created = await db.course.create({
    data: {
      title: course.title,
      slug: course.slug,
      description: course.description,
      status: course.status,
      featured: course.featured,
      priceCents: course.priceCents,
      originalPriceCents: course.originalPriceCents,
      level: course.level,
      durationSeconds,
      technologies: course.technologies,
      outcomes: course.outcomes,
      requirements: course.requirements,
      projects: {
        create: course.projects.map((project, index) => ({
          title: project.title,
          description: project.description,
          position: index + 1,
        })),
      },
      resources: {
        create: course.resources.map((resource, index) => ({
          title: resource.title,
          url: resource.url,
          position: index + 1,
        })),
      },
    },
  });

  for (const [moduleIndex, module] of course.modules.entries()) {
    await db.module.create({
      data: {
        courseId: created.id,
        title: module.title,
        description: module.description,
        position: moduleIndex + 1,
        lessons: {
          create: module.lessons.map((lesson, lessonIndex) => ({
            courseId: created.id,
            title: lesson.title,
            slug: slugify(lesson.title),
            description: lesson.description,
            durationSeconds: lesson.durationSeconds,
            position: lessonIndex + 1,
            isPreview: lesson.isPreview ?? false,
          })),
        },
      },
    });
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Nourhan Saeed";

  if (!email || !password || password.length < 10) {
    throw new Error("Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 10 characters.");
  }

  const passwordHash = await hash(password, 12);
  await db.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN" },
    create: { email, name, passwordHash, role: "ADMIN" },
  });
}

async function seedStudents() {
  const accounts = [
    {
      email: process.env.SEED_STUDENT_A_EMAIL,
      password: process.env.SEED_STUDENT_A_PASSWORD,
      name: process.env.SEED_STUDENT_A_NAME?.trim() || "Student A",
      enroll: true,
    },
    {
      email: process.env.SEED_STUDENT_B_EMAIL,
      password: process.env.SEED_STUDENT_B_PASSWORD,
      name: process.env.SEED_STUDENT_B_NAME?.trim() || "Student B",
      enroll: false,
    },
  ];

  for (const account of accounts) {
    const email = account.email?.trim().toLowerCase();
    if (!email || !account.password || account.password.length < 10) {
      throw new Error(`Set ${account.enroll ? "SEED_STUDENT_A" : "SEED_STUDENT_B"}_EMAIL and a password of at least 10 characters.`);
    }
    const passwordHash = await hash(account.password, 12);
    const user = await db.user.upsert({
      where: { email },
      update: { name: account.name, passwordHash, role: "STUDENT" },
      create: { email, name: account.name, passwordHash, role: "STUDENT" },
    });
    if (!account.enroll) continue;
    const course = await db.course.findUnique({ where: { slug: "angular-signals" }, select: { id: true } });
    if (!course) continue;
    await db.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      update: { status: "ACTIVE", source: "MANUAL", completedAt: null },
      create: { userId: user.id, courseId: course.id, status: "ACTIVE", source: "MANUAL" },
    });
  }
}

async function main() {
  await seedAdmin();
  for (const course of courses) {
    await seedCourse(course);
  }
  await seedStudents();
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
