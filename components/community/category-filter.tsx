"use client";

import { Button } from "@/components/ui/button";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  color?: string;
}

interface CategoryFilterProps {
  categories: Category[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selected === null ? "default" : "outline"}
        size="sm"
        onClick={() => onSelect(null)}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selected === category.slug ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(category.slug)}
        >
          {category.icon && (
            <span className="mr-1" style={{ color: category.color }}>
              {category.icon}
            </span>
          )}
          {category.name}
        </Button>
      ))}
    </div>
  );
}
