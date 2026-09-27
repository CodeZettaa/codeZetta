import { CourseLevel } from "@prisma/client";

export function audienceFor(level: CourseLevel, technologies: string[]) {
  const stack = technologies.slice(0, 3).join(", ") || "the stack";
  if (level === "BEGINNER") {
    return [
      `Developers starting with ${stack} who want a correct mental model first.`,
      "People who would rather understand a small system than collect API trivia.",
    ];
  }
  if (level === "INTERMEDIATE") {
    return [
      `Developers who use ${stack} and want to see why the runtime behaves the way it does.`,
      "Engineers who will build the course projects, not only watch them.",
    ];
  }
  return [
    `Engineers who already ship with ${stack} and want the model underneath the API.`,
    "People preparing for a design review, not a syntax quiz.",
    "Developers who will build the course projects, not only watch them.",
  ];
}

export const courseFaq = [
  {
    question: "Can I watch a lesson before enrolling?",
    answer: "Lessons marked Preview play without an enrollment. Everything else stays locked until you have access.",
  },
  {
    question: "How is progress counted?",
    answer: "Course progress is completed lessons divided by total lessons. Marking a lesson complete updates it immediately.",
  },
  {
    question: "How do I get access?",
    answer: "Create an account. Checkout is not connected yet, so an instructor grants enrollment manually.",
  },
];
