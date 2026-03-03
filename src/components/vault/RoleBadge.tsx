import type { VaultRole } from "../../store/workspace";

interface Props {
  role: VaultRole;
}

export default function RoleBadge({ role }: Props) {
  if (role === "owner") return null;

  const styles =
    role === "editor"
      ? "bg-amber-900/30 text-amber-400"
      : "bg-obsidian-bg-tertiary text-obsidian-text-muted";

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${styles}`}>
      {role}
    </span>
  );
}
