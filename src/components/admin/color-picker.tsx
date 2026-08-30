'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { COLORS, PALETTE, type ColorToken } from '@/lib/colors';
import { cn } from '@/lib/utils';

/** Palette popover. Stores the token, never a hex value (§7.1). */
export function ColorPicker({
  value,
  onSelect,
  children,
  disabled,
}: {
  value: string;
  onSelect: (color: ColorToken) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {COLORS.map((token) => (
            <button
              key={token}
              type="button"
              title={token}
              onClick={() => onSelect(token)}
              className={cn(
                'size-7 rounded-md transition-transform hover:scale-110',
                PALETTE[token].dot,
                value === token && 'ring-foreground ring-2 ring-offset-2',
              )}
            >
              <span className="sr-only">{token}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
