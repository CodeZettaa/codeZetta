import { Badge } from "@/components/ui/badge";

const labels = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NEW: "New",
  READ: "Read",
  RESOLVED: "Resolved",
} as const;

export function StatusBadge({ status }: { status: keyof typeof labels }) {
  const variant = status === "CANCELLED" ? "destructive" : status === "COMPLETED" || status === "RESOLVED" ? "secondary" : "outline";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}
