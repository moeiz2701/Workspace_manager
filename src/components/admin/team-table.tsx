'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ColorPicker } from '@/components/admin/color-picker';
import { PersonBadge } from '@/components/shell/person-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { setMemberColor, setMemberRole, setMemberTitle } from '@/lib/actions/people';
import type { ColorToken } from '@/lib/colors';
import type { Profile } from '@/types/app';

type Counts = Record<string, { total: number; done: number; in_flight: number }>;

export function TeamTable({
  team,
  meId,
  counts,
}: {
  team: Profile[];
  meId: string;
  counts: Counts;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team</CardTitle>
        <CardDescription>
          A person&apos;s colour follows them everywhere — every task card, every badge, the graph.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((p) => (
              <TeamRow key={p.id} person={p} isMe={p.id === meId} counts={counts[p.id]} />
            ))}
            {team.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                  Nobody approved yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TeamRow({
  person,
  isMe,
  counts,
}: {
  person: Profile;
  isMe: boolean;
  counts?: { total: number; done: number; in_flight: number };
}) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(person.title ?? '');

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });

  return (
    <TableRow>
      <TableCell>
        <ColorPicker
          value={person.color}
          onSelect={(c: ColorToken) => run(() => setMemberColor(person.id, c), 'Colour updated')}
        >
          <Button variant="ghost" size="icon" className="size-8" aria-label="Change colour">
            <PersonBadge person={person} size="sm" />
          </Button>
        </ColorPicker>
      </TableCell>

      <TableCell>
        <div className="text-sm font-medium">
          {person.full_name ?? '—'}
          {isMe ? <span className="text-muted-foreground font-normal"> (you)</span> : null}
        </div>
        <div className="text-muted-foreground text-xs">{person.email}</div>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <Input
          value={title}
          placeholder="e.g. Backend"
          className="h-8 max-w-36"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if ((person.title ?? '') !== title) {
              run(() => setMemberTitle(person.id, title), 'Title updated');
            }
          }}
        />
      </TableCell>

      <TableCell>
        <Select
          value={person.role}
          onValueChange={(v) =>
            run(() => setMemberRole(person.id, v as 'admin' | 'member'), 'Role updated')
          }
        >
          <SelectTrigger className="h-8 w-28" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <Badge variant={person.status === 'approved' ? 'secondary' : 'outline'}>
          {person.status}
        </Badge>
      </TableCell>

      <TableCell className="text-right text-sm">
        {counts ? (
          <span className="tabular-nums">
            {counts.done}/{counts.total}
            {counts.in_flight > 0 ? (
              <span className="text-muted-foreground"> · {counts.in_flight} active</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
