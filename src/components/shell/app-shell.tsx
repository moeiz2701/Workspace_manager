'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { SidebarBrand, SidebarNav } from '@/components/shell/sidebar-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const SIDEBAR_COOKIE = 'sidebar_collapsed';

/**
 * Application chrome: the collapsible desktop rail, the mobile drawer, and the
 * sticky header.
 *
 * Collapse state round-trips through a cookie rather than localStorage because
 * the layout is already server-rendered per request (§8.2 forces it dynamic).
 * Reading it on the server means the rail renders at its final width on the
 * first paint — with localStorage it would render expanded and snap shut.
 */
export function AppShell({
  isAdmin,
  defaultCollapsed,
  headerActions,
  children,
}: {
  isAdmin: boolean;
  defaultCollapsed: boolean;
  headerActions: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      // One year; SameSite=Lax so it still arrives on top-level navigations.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Cmd/Ctrl+B and a bare `[`. Plain letters are already taken by the view
  // shortcuts in KeyboardShortcuts, so this deliberately does not use `b` alone.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'combobox');

      const chord = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'b';
      const bracket = e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing;

      if (chord || bracket) {
        e.preventDefault();
        toggle();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return (
    <div className="bg-background flex min-h-dvh">
      <aside
        data-collapsed={collapsed}
        className={cn(
          'bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh shrink-0 flex-col',
          'border-r transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-[4.5rem]' : 'w-60',
        )}
      >
        <div className={cn('flex h-16 items-center', collapsed ? 'justify-center px-2' : 'px-3')}>
          <SidebarBrand collapsed={collapsed} />
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4">
          <SidebarNav isAdmin={isAdmin} collapsed={collapsed} />
        </div>

        <div
          className={cn(
            'border-sidebar-border/70 border-t p-2',
            collapsed ? 'flex justify-center' : '',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? 'icon-sm' : 'sm'}
                onClick={toggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                className={cn(
                  'text-muted-foreground hover:text-foreground',
                  collapsed ? '' : 'w-full justify-start gap-2.5 px-3',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-[1.125rem]" />
                ) : (
                  <>
                    <PanelLeftClose className="size-[1.125rem]" />
                    <span>Collapse</span>
                    <kbd className="border-border/70 text-muted-foreground/70 ml-auto rounded border px-1.5 py-px text-[10px] leading-4 font-medium">
                      [
                    </kbd>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              <span className="text-background/60 ml-2">[</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'bg-background/85 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-30',
            'flex h-16 items-center gap-2 border-b px-4 backdrop-blur-md md:px-6',
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="md:hidden">
            <SidebarBrand />
          </div>

          <div className="flex-1" />
          <div className="flex items-center gap-1">{headerActions}</div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="bg-sidebar w-72 gap-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Jump between the board, task list, dependency graph and tracker.
          </SheetDescription>

          <div className="flex h-16 items-center px-3">
            <SidebarBrand onNavigate={() => setDrawerOpen(false)} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <SidebarNav isAdmin={isAdmin} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
