'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, Send } from 'lucide-react';
import { toast } from 'sonner';

import { PersonBadge } from '@/components/shell/person-badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { addComment } from '@/lib/actions/comments';
import { formatMention } from '@/lib/mentions';
import type { Profile } from '@/types/app';

/**
 * Comment composer with an @-mention picker.
 *
 * A plain textarea rather than a rich editor (the fallback §1 allows): the only
 * markup this app needs is the mention token, and a textarea keeps the stored
 * body plain and searchable.
 */
export function CommentComposer({
  taskId,
  team,
  parentCommentId,
  placeholder = 'Add a comment…  type @ to mention someone',
  autoFocus,
  onDone,
}: {
  taskId: string;
  team: Profile[];
  parentCommentId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function insertMention(person: Profile) {
    const token = formatMention(person.full_name ?? person.email, person.id);
    const element = textareaRef.current;

    setBody((current) => {
      if (!element) return `${current}${current && !current.endsWith(' ') ? ' ' : ''}${token} `;

      const start = element.selectionStart;
      // Swallow the "@" that opened the picker, if the caret sits right after one.
      const before = current.slice(0, start).replace(/@$/, '');
      const after = current.slice(start);
      return `${before}${token} ${after}`;
    });

    setPickerOpen(false);
    queueMicrotask(() => element?.focus());
  }

  function submit() {
    if (!body.trim()) return;

    startTransition(async () => {
      const res = await addComment({ taskId, body, parentCommentId: parentCommentId ?? null });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setBody('');
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        rows={parentCommentId ? 2 : 3}
        value={body}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setBody(e.target.value);
          // Opening on "@" keeps the picker discoverable without a toolbar.
          if (e.target.value.endsWith('@')) setPickerOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          <Send className="size-3.5" /> {parentCommentId ? 'Reply' : 'Comment'}
        </Button>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" type="button">
              <AtSign className="size-3.5" /> Mention
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command>
              <CommandInput placeholder="Mention someone…" />
              <CommandList>
                <CommandEmpty>Nobody found.</CommandEmpty>
                <CommandGroup>
                  {team.map((person) => (
                    <CommandItem
                      key={person.id}
                      value={`${person.full_name ?? ''} ${person.email}`}
                      onSelect={() => insertMention(person)}
                    >
                      <PersonBadge person={person} size="xs" />
                      <span className="truncate">{person.full_name ?? person.email}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {onDone ? (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}

        <span className="text-muted-foreground ml-auto text-[11px]">⌘↵ to send</span>
      </div>
    </div>
  );
}
