"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLEND_MODE_GROUPS } from "@/lib/fabric/blend-modes";
import type { BlendMode } from "@/types/editor";

interface BlendModeSelectorProps {
  value: BlendMode;
  onChange: (mode: BlendMode) => void;
}

export default function BlendModeSelector({
  value,
  onChange,
}: BlendModeSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as BlendMode)}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BLEND_MODE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-xs">{group.label}</SelectLabel>
            {group.modes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value} className="text-xs">
                {mode.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
