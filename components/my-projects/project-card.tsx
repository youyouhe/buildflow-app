"use client";

import Link from "next/link";
import { formatDistance } from "date-fns";
import { Download, EllipsisVertical, Trash } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Project } from "@/types";
import { toast } from "sonner";

// Temporary simplified ProjectCard component for BuildFlow migration
// TODO: Implement full project card with IndexedDB integration

export const ProjectCard = ({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: () => void;
}) => {
  // Use state for current time to avoid hydration mismatch
  const [now, setNow] = useState(project.updatedAt); // Start with updatedAt to avoid jump
  
  useEffect(() => {
    // Set actual current time on client
    setNow(Date.now());
    
    // Update every minute to keep relative time fresh
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="relative rounded-xl h-64 lg:h-44 border border-neutral-800 overflow-hidden group"
      style={{
        backgroundImage: project.thumbnail 
          ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)), url(${project.thumbnail})`
          : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: project.thumbnail ? 'transparent' : 'rgb(23 23 23)', // neutral-900
      }}
    >
      <Link href={`/projects/local/${project.id}`} className="block h-full p-4">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-sm text-neutral-200 mt-1 line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {project.description}
              </p>
            )}
          </div>
          <div className="text-xs text-neutral-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Updated {formatDistance(project.updatedAt, now, { addSuffix: true })}
          </div>
        </div>
      </Link>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-neutral-800/80 hover:bg-neutral-700 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toast.info("Download coming soon!");
                }}
                className="cursor-pointer"
              >
                <Download className="size-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="cursor-pointer text-red-500"
              >
                <Trash className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
