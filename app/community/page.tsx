"use client";

import { useState, useEffect } from "react";
import { Grid, List } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { NotLogged } from "@/components/not-logged/not-logged";
import { CommunityProjectCard } from "@/components/community/project-card";
import { CategoryFilter } from "@/components/community/category-filter";
import { SortDropdown } from "@/components/community/sort-dropdown";
import { SearchInput } from "@/components/community/search-input";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function CommunityPage() {
  const { user } = useUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "trending" | "downloads">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [supabaseNotConfigured, setSupabaseNotConfigured] = useState(false);

  useEffect(() => {
    setSupabaseNotConfigured(!isSupabaseConfigured());
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadCategories();
      loadProjects();
    }
  }, [selectedCategory, sortBy, searchQuery]);

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/community/categories");
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sort: sortBy,
        ...(selectedCategory && { category: selectedCategory }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/community/projects?${params}`);
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("Failed to load community projects");
    } finally {
      setLoading(false);
    }
  };

  if (supabaseNotConfigured) {
    return (
      <div className="max-w-[86rem] py-12 px-4 mx-auto">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-white mb-4">
            Community Not Available
          </h1>
          <p className="text-neutral-400 text-lg mb-6">
            Community features are not configured. Please set up Supabase to enable community sharing.
          </p>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-white font-semibold mb-2">Setup Instructions</h3>
            <ol className="text-neutral-400 text-left text-sm space-y-2 list-decimal list-inside">
              <li>Create a Supabase project at supabase.com</li>
              <li>Run the SQL migration files in the Supabase SQL editor</li>
              <li>Add the Supabase environment variables to your .env.local file</li>
              <li>Restart the development server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <NotLogged />;
  }

  return (
    <div className="max-w-[86rem] py-12 px-4 mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Community Projects
        </h1>
        <p className="text-neutral-400 text-lg">
          Explore and download projects shared by the BuildFlow community
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search projects..."
          />
        </div>

        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <SortDropdown value={sortBy} onChange={setSortBy} />

        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="size-5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="size-5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-neutral-500 py-12">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center text-neutral-500 py-12">
          <p className="text-lg">No projects found</p>
          <p className="text-sm mt-2">
            Try adjusting your filters or search query
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-6 ${
            viewMode === "grid"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1"
          }`}
        >
          {projects.map((project) => (
            <CommunityProjectCard
              key={project.id}
              project={project}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
