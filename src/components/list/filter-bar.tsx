'use client';

import { Check, Search, SlidersHorizontal, X } from 'lucide-react';

import { PersonBadge } from '@/components/shell/person-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { colorOf } from '@/lib/colors';
import { EMPTY_FILTERS, countActiveFilters } from '@/lib/filters';
import { useDebouncedSearch, useTaskFilters } from '@/lib/use-task-filters';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS, type Category, type Profile, type TaskPriority } from '@/types/app';

const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

/**
 * Shared by the board and the list (§7.2), so the two views can never present
 * different filters. State lives in the URL (see useTaskFilters).
 */
export function FilterBar({
  categories,
  team,
  resultCount,
  totalCount,
  children,
}: {
  categories: Category[];
  team: Profile[];
  resultCount: number;
  totalCount: number;
  children?: React.ReactNode;
}) {
  const { filters, setFilters, patch, toggle } = useTaskFilters();
  const [search, setSearch] = useDebouncedSearch(filters.search, (value) =>
    patch({ search: value }),
  );

  const active = countActiveFilters(filters);

  return (
    <div className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b px-4 py-3 backdrop-blur-md md:px-6">
      <div className="relative min-w-48 flex-1 sm:max-w-72">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          data-search-input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="h-9 pr-9 pl-9"
        />
        <kbd className="border-border/70 text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 py-px text-[10px] leading-4 font-medium sm:block">
          /
        </kbd>
      </div>

      <MultiSelect
        label="Category"
        count={filters.categories.length}
        items={categories.map((c) => ({
          value: c.key,
          label: c.name,
          swatch: colorOf(c.color).dot,
        }))}
        selected={filters.categories}
        onToggle={(v) => toggle('categories', v)}
      />

      <MultiSelect
        label="Assignee"
        count={filters.assignees.length}
        items={team.map((p) => ({
          value: p.id,
          label: p.full_name ?? p.email,
          badge: <PersonBadge person={p} size="xs" />,
        }))}
        selected={filters.assignees}
        onToggle={(v) => toggle('assignees', v)}
      />

      <MultiSelect
        label="Priority"
        count={filters.priorities.length}
        items={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        selected={filters.priorities}
        onToggle={(v) => toggle('priorities', v)}
      />

      <Button
        variant={filters.onlyMine ? 'default' : 'outline'}
        size="sm"
        className="h-9"
        onClick={() => patch({ onlyMine: !filters.onlyMine })}
      >
        {filters.onlyMine ? <Check className="size-3.5" /> : null}
        Only mine
      </Button>

      <Button
        variant={filters.hideBlocked ? 'default' : 'outline'}
        size="sm"
        className="h-9"
        onClick={() => patch({ hideBlocked: !filters.hideBlocked })}
      >
        {filters.hideBlocked ? <Check className="size-3.5" /> : null}
        Hide blocked
      </Button>

      {active > 0 ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilters(EMPTY_FILTERS)}>
          <X className="size-3.5" /> Clear
          <Badge variant="secondary" className="ml-1 tabular-nums">
            {active}
          </Badge>
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        <span className="text-muted-foreground text-xs font-medium tabular-nums">
          {resultCount === totalCount ? `${totalCount} tasks` : `${resultCount} of ${totalCount}`}
        </span>
        {children}
      </div>
    </div>
  );
}

function MultiSelect({
  label,
  items,
  selected,
  onToggle,
  count,
}: {
  label: string;
  items: { value: string; label: string; swatch?: string; badge?: React.ReactNode }[];
  selected: string[];
  onToggle: (value: string) => void;
  count: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <SlidersHorizontal className="size-3.5" />
          {label}
          {count > 0 ? (
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {count}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-sm">Nothing to filter by</div>
        ) : (
          items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={selected.includes(item.value)}
              onCheckedChange={() => onToggle(item.value)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.swatch ? (
                  <span className={cn('size-2.5 shrink-0 rounded-full', item.swatch)} />
                ) : null}
                {item.badge}
                <span className="truncate">{item.label}</span>
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
