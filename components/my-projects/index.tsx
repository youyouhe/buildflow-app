"use client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { useUser } from "@/hooks/useUser";
import { NotLogged } from "../not-logged/not-logged";
import { ProjectCard } from "./project-card";
import { getAllProjects, deleteProject } from "@/lib/indexeddb/projects";
import { Project } from "@/types";
import { ShareModal } from "@/components/community/share-modal";

export function MyProjects() {
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("Failed to load projects from storage");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (project: Project) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteProject(project.id);
      toast.success(`Project "${project.title}" deleted successfully`);
      // Reload projects after deletion
      await loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    }
  };

  const handleShare = (project: Project) => {
    setSelectedProject(project);
    setShareModalOpen(true);
  };

  if (!user) {
    return <NotLogged />;
  }

  return (
    <>
      <section className="max-w-[86rem] py-12 px-4 mx-auto overflow-x-hidden">
        <header className="flex items-center justify-between max-lg:flex-col gap-4">
          <div className="text-left">
            <h1 className="text-3xl font-bold text-white">
              <span className="capitalize">{user?.name || user?.login}</span>&apos;s
              BuildFlow Projects
            </h1>
            <p className="text-muted-foreground text-lg mt-1 max-w-xl">
              Create, manage, and explore your BuildFlow projects.
            </p>
          </div>
        </header>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Link
            href="/new"
            className="bg-neutral-900 rounded-xl h-64 lg:h-44 flex items-center justify-center text-neutral-300 border border-neutral-800 hover:brightness-110 transition-all duration-200"
          >
            <Plus className="size-5 mr-1.5" />
            Create Project
          </Link>
          {loading ? (
            <div className="bg-neutral-900 rounded-xl h-64 lg:h-44 flex items-center justify-center text-neutral-500 border border-neutral-800">
              Loading projects...
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={() => handleDeleteClick(project)}
                onShare={() => handleShare(project)}
              />
            ))
          )}
        </div>
        {!loading && projects.length === 0 && (
          <div className="text-center text-neutral-500 mt-12">
            <p className="text-lg">No projects yet</p>
            <p className="text-sm mt-2">Create your first BuildFlow project to get started!</p>
          </div>
        )}
      </section>

      {selectedProject && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          project={{
            id: selectedProject.id,
            title: selectedProject.title,
            description: selectedProject.description,
            files: selectedProject.files,
            prompts: selectedProject.prompts,
            thumbnail: selectedProject.thumbnail,
          }}
        />
      )}
    </>
  );
}
