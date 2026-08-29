import Link from "next/link";
import { UserMenu } from "@/components/dashboard/user-menu";

export function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
          Dashboard
        </Link>
        <Link href="/businesses" className="text-slate-600 hover:text-slate-900">
          Businesses
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
