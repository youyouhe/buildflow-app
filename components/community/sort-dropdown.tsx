"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type SortOption = 'recent' | 'popular' | 'trending' | 'downloads';

const SORT_OPTIONS: Record<SortOption, { label: string; description: string }> = {
  recent: { label: 'Recent', description: 'Sort by most recently created' },
  popular: { label: 'Most Viewed', description: 'Sort by most views' },
  trending: { label: 'Most Liked', description: 'Sort by most likes' },
  downloads: { label: 'Most Downloaded', description: 'Sort by most downloads' },
};

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const selectedOption = SORT_OPTIONS[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[160px] justify-start">
          <ArrowUpDown className="size-4 mr-2" />
          {selectedOption.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {Object.entries(SORT_OPTIONS).map(([key, { label, description }]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key as SortOption)}
            className={value === key ? "bg-neutral-800" : ""}
          >
            <div className="flex flex-col">
              <span>{label}</span>
              <span className="text-xs text-neutral-400">{description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
