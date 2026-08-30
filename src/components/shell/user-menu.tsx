'use client';

import { LogOut, ShieldCheck, User } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/actions/auth';
import { colorOf, initialsOf } from '@/lib/colors';
import type { Profile } from '@/types/app';

export function UserMenu({ profile }: { profile: Profile }) {
  const color = colorOf(profile.color);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="size-6">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback className={`${color.badge} text-[10px]`}>
              {initialsOf(profile.full_name, profile.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm sm:inline">
            {profile.full_name ?? profile.email}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{profile.full_name ?? '—'}</span>
            <span className="text-muted-foreground truncate text-xs">{profile.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          {profile.role === 'admin' ? (
            <ShieldCheck className="size-4" />
          ) : (
            <User className="size-4" />
          )}
          {profile.role === 'admin' ? 'Admin' : 'Member'}
          {profile.title ? ` · ${profile.title}` : ''}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
