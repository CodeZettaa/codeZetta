import { CourseLevel } from "@prisma/client";

export function audienceFor(level: CourseLevel, technologies: string[]) {
  const stack = technologies.slice(0, 3).join(", ") || "the stack";
  if (level === "ADVANCED") {
    return [
      `Engineers who already ship with ${stack} and want the model underneath the API.`,
      "People who will build the projects, then explain the decisions in a review.",
      "Developers who are past syntax and want to see why a framework chose this shape.",
    ];
  }
  if (level === "BEGINNER") {
    return [
      `Developers starting with ${stack} who want a correct mental model first.`,
      "People who would rather understand one path deeply than sample ten tutorials.",
    ];
  }
  return [
    `Developers with working ${stack} experience who want the internals, not another tour of the docs.`,
    "People who can already build a feature and want to know why it behaves the way it does.",
  ];
}

export const courseFaq = [
  {
    question: "Can I watch a lesson before enrolling?",
    answer: "Lessons marked Preview play without an enrollment. Everything else stays locked, including the video reference.",
  },
  {
    question: "How is progress counted?",
    answer: "Progress is completed lessons divided by the lessons in the course. It is calculated when you mark a lesson complete.",
  },
  {
    question: "How do I get access?",
    answer: "Create an account and buy the course. Access starts after the payment is confirmed on the server. The instructor can also enroll you directly.",
  },
  {
    question: "Can I resume where I left off?",
    answer: "Yes. The player stores your position in the lesson and the dashboard opens the lesson you should continue.",
  },
];
