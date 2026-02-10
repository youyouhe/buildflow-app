"use client";

import Link from "next/link";
import { formatDistance } from "date-fns";
import { Eye, Download, Heart, User } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface CommunityProject {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  views_count: number;
  downloads_count: number;
  likes_count: number;
  created_at: string;
  category?: {
    slug: string;
    name: string;
    icon?: string;
    color?: string;
  };
  profile?: {
    github_login: string;
    github_name?: string;
    github_avatar_url: string;
  };
  user_liked?: boolean;
}

interface ProjectCardProps {
  project: CommunityProject;
  viewMode?: "grid" | "list";
  onLikeToggle?: (projectId: string) => void;
}

export function CommunityProjectCard({
  project,
  viewMode = "grid",
  onLikeToggle,
}: ProjectCardProps) {
  const [liked, setLiked] = useState(project.user_liked || false);
  const [likesCount, setLikesCount] = useState(project.likes_count);
  const [downloading, setDownloading] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (togglingLike) return;

      setTogglingLike(true);
      const prevLiked = liked;
      const prevCount = likesCount;

      // Optimistic update
      setLiked(!prevLiked);
      setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);

      try {
        const response = await fetch(`/api/community/projects/${project.id}/like`, {
          method: liked ? "DELETE" : "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update like");
        }

        const data = await response.json();
        setLiked(data.liked);
        setLikesCount(data.likes_count);

        if (onLikeToggle) {
          onLikeToggle(project.id);
        }
      } catch (error) {
        console.error("Failed to like project:", error);
        // Revert on error
        setLiked(prevLiked);
        setLikesCount(prevCount);
        toast.error("Failed to update like");
      } finally {
        setTogglingLike(false);
      }
    },
    [project.id, liked, likesCount, togglingLike, onLikeToggle]
  );

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setDownloading(true);
      try {
        const response = await fetch(`/api/community/projects/${project.id}/download`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to download project");
        }

        const data = await response.json();

        // Import to IndexedDB
        const { createProject } = await import("@/lib/indexeddb/projects");
        await createProject({
          title: data.title,
          description: data.description,
          files: data.files,
          prompts: data.prompts || [],
        });

        toast.success(
          "Project downloaded successfully! Check your local projects."
        );
        setLikesCount((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to download project:", error);
        toast.error("Failed to download project");
      } finally {
        setDownloading(false);
      }
    },
    [project.id]
  );

  return (
    <Link
      href={`/community/projects/${project.id}`}
      className={`block group relative rounded-xl border border-neutral-800 overflow-hidden transition-all duration-200 hover:brightness-110 ${
        viewMode === "grid" ? "h-64" : "flex h-32"
      }`}
      style={{
        backgroundImage:
          project.thumbnail && viewMode === "grid"
            ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)), url(${project.thumbnail})`
            : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: project.thumbnail
          ? "transparent"
          : "rgb(23 23 23)",
      }}
    >
      <div
        className={`p-4 flex flex-col justify-between h-full ${
          viewMode === "list" ? "flex-row items-center gap-4" : ""
        }`}
      >
        <div className={viewMode === "list" ? "flex-1" : ""}>
          {project.category && (
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: project.category.color + "20",
                  color: project.category.color,
                }}
              >
                {project.category.icon} {project.category.name}
              </span>
            </div>
          )}

          <h3 className="text-lg font-semibold text-white truncate drop-shadow-lg">
            {project.title}
          </h3>

          {project.description && (
            <p className="text-sm text-neutral-200 mt-1 line-clamp-2 drop-shadow-md">
              {project.description}
            </p>
          )}

          {project.profile && (
            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-300">
              <User className="size-3" />
              <span>
                {project.profile.github_name || project.profile.github_login}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-neutral-300">
            <span className="flex items-center gap-1" title="Views">
              <Eye className="size-3" />
              {project.views_count}
            </span>
            <span className="flex items-center gap-1" title="Downloads">
              <Download className="size-3" />
              {project.downloads_count}
            </span>
            <button
              onClick={handleLike}
              disabled={togglingLike}
              className={`flex items-center gap-1 hover:text-red-400 transition-colors ${
                liked ? "text-red-500" : ""
              }`}
              title="Like"
            >
              <Heart className={`size-3 ${liked ? "fill-current" : ""}`} />
              {likesCount}
            </button>
          </div>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="sm"
            className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {downloading ? "Downloading..." : "Download"}
          </Button>
        </div>
      </div>
    </Link>
  );
}
