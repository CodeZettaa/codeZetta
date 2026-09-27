function assertMinor(value: number, label: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an integer minor unit.`);
  }
}

export function lineTotal(unitPriceCents: number, quantity: number) {
  assertMinor(unitPriceCents, "Unit price");
  assertMinor(quantity, "Quantity");
  if (unitPriceCents < 0 || quantity < 1) {
    throw new Error("A line needs a non-negative price and a quantity of at least 1.");
  }
  const total = unitPriceCents * quantity;
  if (!Number.isSafeInteger(total)) {
    throw new Error("Line total overflowed.");
  }
  return total;
}

export function orderTotal(subtotalCents: number, discountCents: number) {
  assertMinor(subtotalCents, "Subtotal");
  assertMinor(discountCents, "Discount");
  if (subtotalCents < 0 || discountCents < 0 || discountCents > subtotalCents) {
    throw new Error("Discount cannot exceed the subtotal.");
  }
  return subtotalCents - discountCents;
}

export type CourseQuote = {
  courseTitleSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
};

/** Authoritative price for a new order. The browser never supplies these numbers. */
export function quoteCourse(course: { title: string; priceCents: number; currency: string }): CourseQuote {
  const unitPriceCents = course.priceCents;
  const quantity = 1;
  const subtotalCents = lineTotal(unitPriceCents, quantity);
  const discountCents = 0;
  return {
    courseTitleSnapshot: course.title,
    unitPriceCents,
    quantity,
    subtotalCents,
    discountCents,
    totalCents: orderTotal(subtotalCents, discountCents),
    currency: course.currency,
  };
}
