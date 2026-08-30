'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ColorPicker } from '@/components/admin/color-picker';
import { CategoryIcon } from '@/components/shell/category-icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCategory, updateCategory } from '@/lib/actions/categories';
import { PALETTE, type ColorToken } from '@/lib/colors';
import { CATEGORY_ICONS } from '@/lib/schemas/category';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/app';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}) {
  const editing = !!category;
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ColorToken>('slate');
  const [icon, setIcon] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setKey(category?.key ?? '');
    setKeyTouched(!!category);
    setDescription(category?.description ?? '');
    setColor((category?.color as ColorToken) ?? 'slate');
    setIcon(category?.icon ?? '');
  }, [open, category]);

  function submit() {
    const input = {
      key: key.trim(),
      name: name.trim(),
      description: description.trim() || null,
      color,
      icon: icon || null,
    };

    startTransition(async () => {
      const res = editing ? await updateCategory(category!.id, input) : await createCategory(input);

      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? 'Category updated' : 'Category created');
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            The key is the stable identity used by JSON import — changing it on an existing category
            will make the next import create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              placeholder="ML Signal Pipeline"
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugify(e.target.value));
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-key">Key</Label>
            <Input
              id="cat-key"
              value={key}
              placeholder="ml-pipeline"
              className="font-mono"
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={description}
              rows={2}
              placeholder="What lives in this area of the build."
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <ColorPicker value={color} onSelect={setColor}>
                <Button variant="outline" className="w-32 justify-start gap-2">
                  <span className={cn('size-4 rounded', PALETTE[color].dot)} />
                  {color}
                </Button>
              </ColorPicker>
            </div>

            <div className="min-w-56 flex-1 space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1">
                {CATEGORY_ICONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    title={n}
                    onClick={() => setIcon(icon === n ? '' : n)}
                    className={cn(
                      'hover:bg-accent flex size-8 items-center justify-center rounded-md border',
                      icon === n && 'border-foreground bg-accent',
                    )}
                  >
                    <CategoryIcon name={n} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim() || !key.trim()}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
