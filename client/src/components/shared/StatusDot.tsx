type Status = "safe" | "warning" | "danger" | "idle";

const colors: Record<Status, string> = {
  safe: "bg-green",
  warning: "bg-amber",
  danger: "bg-red animate-pulse",
  idle: "bg-muted",
};

export default function StatusDot({ status }: { status: Status }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
  );
}
