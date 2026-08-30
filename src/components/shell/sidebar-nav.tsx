'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderKanban,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Shapes,
  Target,
  Upload,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const MAIN = [
  { href: '/board', label: 'Board', icon: LayoutGrid, key: 'b' },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, key: 'l' },
  { href: '/graph', label: 'Graph', icon: GitBranch, key: 'g' },
  { href: '/tracker', label: 'Tracker', icon: Target, key: 't' },
];

const ADMIN = [
  { href: '/admin/people', label: 'People', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: Shapes },
  { href: '/admin/import', label: 'Import', icon: Upload },
];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const item = (href: string, label: string, Icon: typeof LayoutGrid, hint?: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
          active
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {hint ? (
          <kbd className="text-muted-foreground/60 hidden text-[10px] group-hover:inline">
            {hint}
          </kbd>
        ) : null}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-1">
      <div className="text-muted-foreground px-2.5 pb-1 text-[11px] font-medium tracking-wide uppercase">
        Workspace
      </div>
      {MAIN.map((i) => item(i.href, i.label, i.icon, i.key))}

      {isAdmin ? (
        <>
          <div className="text-muted-foreground px-2.5 pt-4 pb-1 text-[11px] font-medium tracking-wide uppercase">
            Admin
          </div>
          {ADMIN.map((i) => item(i.href, i.label, i.icon))}
        </>
      ) : null}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <Link href="/board" className="flex items-center gap-2 px-2.5 py-1">
      <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-md">
        <FolderKanban className="size-4" />
      </span>
      <span className="text-sm leading-tight font-semibold">
        Entropable
        <span className="text-muted-foreground block text-[11px] font-normal">Workspace</span>
      </span>
    </Link>
  );
}
