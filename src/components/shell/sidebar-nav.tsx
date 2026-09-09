'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderKanban,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Shapes,
  Sparkles,
  Target,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: LucideIcon; key?: string };

const MAIN: NavItem[] = [
  { href: '/start', label: 'Start', icon: Sparkles, key: 'S' },
  { href: '/board', label: 'Board', icon: LayoutGrid, key: 'B' },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, key: 'L' },
  { href: '/graph', label: 'Graph', icon: GitBranch, key: 'G' },
  { href: '/tracker', label: 'Tracker', icon: Target, key: 'T' },
];

const ADMIN: NavItem[] = [
  { href: '/admin/people', label: 'People', icon: Users, key: 'P' },
  { href: '/admin/categories', label: 'Categories', icon: Shapes },
  { href: '/admin/import', label: 'Import', icon: Upload, key: 'I' },
];

/**
 * The nav renders in three places — the desktop rail, the mobile drawer, and
 * (collapsed) the icon rail — so `collapsed` is a prop rather than context: the
 * drawer is never collapsed even when the desktop rail is.
 */
export function SidebarNav({
  isAdmin,
  collapsed = false,
  onNavigate,
}: {
  isAdmin: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const item = ({ href, label, icon: Icon, key }: NavItem) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);

    const link = (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
          'focus-visible:ring-ring/60 outline-none focus-visible:ring-2',
          collapsed ? 'h-10 w-10 justify-center' : 'h-9 gap-3 px-3',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
        )}
      >
        {/* The active marker is a shape, not just a tint, so it survives at a
            glance and in high-contrast modes. */}
        {active ? (
          <span
            aria-hidden
            className={cn(
              'bg-sidebar-primary absolute rounded-full',
              collapsed ? 'inset-x-2 -bottom-0.5 h-0.5' : 'top-1.5 bottom-1.5 -left-2 w-1',
            )}
          />
        ) : null}

        <Icon className={cn('size-[1.125rem] shrink-0', active && 'text-sidebar-primary')} />

        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <>
            <span className="flex-1 truncate">{label}</span>
            {key ? (
              <kbd
                className={cn(
                  'text-muted-foreground/70 border-border/70 hidden rounded border px-1.5 py-px',
                  'text-[10px] leading-4 font-medium group-hover:inline-block',
                  active && 'inline-block',
                )}
              >
                {key}
              </kbd>
            ) : null}
          </>
        )}
      </Link>
    );

    if (!collapsed) return <li key={href}>{link}</li>;

    return (
      <li key={href}>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="font-medium">
            {label}
            {key ? <span className="text-background/60 ml-2">{key}</span> : null}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  };

  return (
    <nav className={cn('flex flex-col gap-1', collapsed ? 'items-center px-0' : 'px-2')}>
      <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
      <ul className={cn('flex flex-col gap-1', collapsed && 'items-center')}>{MAIN.map(item)}</ul>

      {isAdmin ? (
        <>
          <SectionLabel collapsed={collapsed} className="mt-5">
            Admin
          </SectionLabel>
          <ul className={cn('flex flex-col gap-1', collapsed && 'items-center')}>
            {ADMIN.map(item)}
          </ul>
        </>
      ) : null}
    </nav>
  );
}

function SectionLabel({
  children,
  collapsed,
  className,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  className?: string;
}) {
  if (collapsed) {
    return (
      <div className={cn('flex w-full justify-center px-3 pt-2 pb-2', className)} aria-hidden>
        <span className="bg-sidebar-border h-px w-6 rounded-full" />
      </div>
    );
  }

  return <div className={cn('text-eyebrow px-3 pt-2 pb-1.5', className)}>{children}</div>;
}

export function SidebarBrand({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/start"
      onClick={onNavigate}
      className={cn(
        'group flex items-center rounded-lg transition-colors',
        'focus-visible:ring-ring/60 outline-none focus-visible:ring-2',
        collapsed ? 'justify-center p-1' : 'gap-2.5 px-2 py-1.5',
      )}
    >
      <span
        className={cn(
          'bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center',
          'justify-center rounded-lg shadow-sm transition-transform group-hover:scale-105',
        )}
      >
        <FolderKanban className="size-[1.125rem]" />
      </span>

      {collapsed ? (
        <span className="sr-only">Entropable Workspace</span>
      ) : (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold tracking-tight">Entropable</span>
          <span className="text-muted-foreground block truncate text-xs">Workspace</span>
        </span>
      )}
    </Link>
  );
}
