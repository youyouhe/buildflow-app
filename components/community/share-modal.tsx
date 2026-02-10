"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Category } from "@/types";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  project: {
    id: string;
    title: string;
    description?: string;
    files: any[];
    prompts: any[];
    thumbnail?: string;
  };
}

export function ShareModal({ open, onClose, project }: ShareModalProps) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  useEffect(() => {
    setTitle(project.title);
    setDescription(project.description || "");
  }, [project]);

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await fetch("/api/community/categories");
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleShare = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Community features are not configured");
      return;
    }

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/community/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          thumbnail: project.thumbnail,
          files: project.files,
          prompts: project.prompts,
          visibility,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to share project");
      }

      toast.success("Project shared to community successfully!");
      onClose();
    } catch (error) {
      console.error("Failed to share project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to share project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            Share to Community
          </DialogTitle>
          <DialogDescription>
            Share your project with the BuildFlow community
          </DialogDescription>
        </DialogHeader>

        {!isSupabaseConfigured() && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-500">
            Community features are not configured. Please set up Supabase to enable community sharing.
          </div>
        )}

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              maxLength={255}
              disabled={!isSupabaseConfigured()}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project..."
              className="min-h-[100px] bg-neutral-900 border-neutral-800 focus:border-neutral-700 resize-none"
              maxLength={1000}
              disabled={!isSupabaseConfigured()}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {description.length}/1000
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Category <span className="text-red-500">*</span>
            </label>
            {categoriesLoading ? (
              <div className="text-sm text-neutral-500">Loading categories...</div>
            ) : (
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                disabled={!isSupabaseConfigured()}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        {category.icon && (
                          <span style={{ color: category.color }}>
                            {category.icon}
                          </span>
                        )}
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Public Project</label>
              <p className="text-xs text-neutral-400">
                Allow anyone to view and download
              </p>
            </div>
            <Switch
              checked={visibility === "public"}
              onCheckedChange={(checked) =>
                setVisibility(checked ? "public" : "private")
              }
              disabled={!isSupabaseConfigured()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={loading || !isSupabaseConfigured()}
          >
            {loading ? "Sharing..." : "Share Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
