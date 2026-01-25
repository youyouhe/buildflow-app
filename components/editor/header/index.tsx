import {
  ArrowRight,
  HelpCircle,
  RefreshCcw,
  Lock,
  Eye,
  Sparkles,
  Upload,
  Loader2,
  Save,
  Database,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import Logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { ProTag } from "@/components/pro-modal";
import { UserMenu } from "@/components/user-menu";
import { SwitchDevice } from "@/components/editor/switch-devide";
import { SwitchTab } from "./switch-tab";
import { History } from "@/components/editor/history";
import { useEditor } from "@/hooks/useEditor";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DiscordIcon } from "@/components/icons/discord";
import { api } from "@/lib/api";
import { createProject, updateProject } from "@/lib/indexeddb/projects";
import { compress, getCompressionStats } from "@/lib/compression";
import { captureScreenshot } from "@/lib/screenshot";

export function Header({ 
  isNew, 
  namespace, 
  repoId 
}: { 
  isNew: boolean;
  namespace?: string;
  repoId?: string;
}) {
  const { project, pages, prompts, refreshPreview, previewIframeRef } = useEditor(namespace, repoId);
  const { user, openLoginWindow } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const handleSaveToLocal = async () => {
    if (!pages || pages.length === 0) {
      toast.error("No pages to save");
      return;
    }

    setIsSavingLocal(true);
    try {
      // Generate screenshot
      console.log('📸 Generating project thumbnail...');
      const thumbnail = await captureScreenshot(previewIframeRef?.current || null);
      
      if (thumbnail) {
        const sizeKB = (thumbnail.length * 0.75 / 1024).toFixed(1);
        console.log(`✅ Thumbnail generated: ~${sizeKB}KB`);
      } else {
        console.warn('⚠️ Thumbnail generation failed, will use default');
      }

      // Convert pages to ProjectFile format
      // Compress and prepare files for storage
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;
      
      const files = pages.map(page => {
        const content = page.html || page.content || "";
        const originalSize = content.length;
        
        // Compress content for storage efficiency
        const compressedContent = compress(content);
        const stats = getCompressionStats(content, compressedContent);
        
        totalOriginalSize += stats.originalSize;
        totalCompressedSize += stats.compressedSize;
        
        console.log(`📦 ${page.path}: ${stats.originalSize}B → ${stats.compressedSize}B (saved ${stats.compressionRatio})`);
        
        return {
          path: page.path,
          content: compressedContent,
          language: page.path.endsWith('.html') ? 'html' : 
                    page.path.endsWith('.css') ? 'css' : 
                    page.path.endsWith('.js') ? 'javascript' : 'text',
          size: originalSize, // Store original size
          compressed: true,
        };
      });
      
      const totalSaved = totalOriginalSize - totalCompressedSize;
      const totalRatio = ((totalSaved / totalOriginalSize) * 100).toFixed(1);
      console.log(`✅ Total compression: ${totalOriginalSize}B → ${totalCompressedSize}B (saved ${totalRatio}%)`);

      // Check if this is an existing local project
      const isLocalProject = project?.owner === "local" && project?.id;

      if (isLocalProject) {
        // Update existing local project
        const updated = await updateProject(project.id, {
          files,
          prompts: prompts?.map((p: any) => 
            typeof p === 'string' 
              ? { role: 'user', content: p, timestamp: Date.now() }
              : p
          ) || [],
          thumbnail: thumbnail || undefined,
        });

        if (updated) {
          toast.success("Project saved to local storage!");
        } else {
          toast.error("Failed to save: Project not found");
        }
      } else {
        // Create a new local project
        const projectName = prompt("Enter a name for your local project:");
        if (!projectName) {
          setIsSavingLocal(false);
          return;
        }

        const newProject = await createProject({
          title: projectName.trim(),
          description: "Created with BuildFlow AI",
          files,
          prompts: prompts?.map((p: any) => 
            typeof p === 'string' 
              ? { role: 'user', content: p, timestamp: Date.now() }
              : p
          ) || [],
          thumbnail: thumbnail || undefined,
        });

        toast.success(`Project "${projectName}" saved locally!`);
        
        // Redirect to the local project
        setTimeout(() => {
          window.location.href = `/projects/local/${newProject.id}`;
        }, 1500);
      }
    } catch (error: any) {
      console.error("Save to IndexedDB error:", error);
      toast.error(error.message || "Failed to save locally");
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleSaveToGitHub = async () => {
    if (!user) {
      toast.error("Please log in to save to GitHub");
      openLoginWindow();
      return;
    }

    if (!pages || pages.length === 0) {
      toast.error("No pages to save");
      return;
    }

    setIsSaving(true);
    try {
      // Determine if this is a new project or existing
      const isNewProject = !project?.id || project?.id === "new" || project?.id === "unknown";
      
      let endpoint: string;
      let projectName: string | undefined;

      if (isNewProject) {
        // For new projects, prompt for a project name
        const name = prompt("Enter a name for your GitHub repository:");
        if (!name) {
          setIsSaving(false);
          return;
        }
        projectName = name.trim().replace(/\s+/g, "-").toLowerCase();
        // Use "new" as repoId for new projects - the API will handle creation
        endpoint = `/api/me/projects/${user.login}/new/update`;
      } else {
        // For existing projects, use the current project info
        const [namespace, repoId] = (project.fullName || project.id || "").split("/");
        endpoint = `/api/me/projects/${namespace}/${repoId}/update`;
      }

      // Generate commit title from last prompt
      const commitTitle = prompts && prompts.length > 0 && typeof prompts[prompts.length - 1] === 'string'
        ? (prompts[prompts.length - 1] as string).substring(0, 72) 
        : "Update website";

      const response = await api.put(endpoint, {
        pages,
        commitTitle,
        isNew: isNewProject,
        projectName,
      });

      if (response.data.ok) {
        toast.success(
          isNewProject 
            ? `Repository created: ${response.data.repository.fullName}` 
            : "Saved to GitHub successfully"
        );
        
        // If it was a new project, we might want to redirect to the project page
        if (isNewProject && response.data.repository) {
          setTimeout(() => {
            window.location.href = `/${response.data.repository.fullName}`;
          }, 1500);
        }
      } else {
        toast.error(response.data.error || "Failed to save to GitHub");
      }
    } catch (error: any) {
      console.error("Save to GitHub error:", error);
      toast.error(error.response?.data?.error || "Failed to save to GitHub");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="border-b bg-neutral-950 dark:border-neutral-800 grid grid-cols-3 lg:flex items-center max-lg:gap-3 justify-between z-20">
      <div className="flex items-center justify-between lg:max-w-[600px] lg:w-full py-2 px-2 lg:px-3 lg:pl-6 gap-3">
        <h1 className="text-neutral-900 dark:text-white text-lg lg:text-xl font-bold flex items-center justify-start">
          <Image
            src={Logo}
            alt="buildflow Logo"
            className="size-8 invert-100 dark:invert-0"
          />
          <p className="ml-2 flex items-center justify-start max-lg:hidden">
            BuildFlow
            <span className="font-mono bg-gradient-to-r from-sky-500/20 to-sky-500/10 text-sky-500 rounded-full text-xs ml-2 px-1.5 py-0.5 border border-sky-500/20">
              {" "}
              v1.0
            </span>
          </p>
        </h1>
        <div className="flex items-center justify-end gap-2">
          <History namespace={namespace} repoId={repoId} />
          <SwitchTab namespace={namespace} repoId={repoId} />
        </div>
      </div>
      <div className="lg:hidden flex items-center justify-center whitespace-nowrap">
        <SwitchTab isMobile namespace={namespace} repoId={repoId} />
      </div>
      <div className="lg:w-full px-2 lg:px-3 py-2 flex items-center justify-end lg:justify-between lg:border-l lg:border-neutral-800">
        <div className="font-mono text-muted-foreground flex items-center gap-2">
          <SwitchDevice namespace={namespace} repoId={repoId} />
          <Button
            size="xs"
            variant="bordered"
            className="max-lg:hidden"
            onClick={refreshPreview}
          >
            <RefreshCcw className="size-3 mr-0.5" />
            Refresh Preview
          </Button>
          <Button
            size="xs"
            variant="bordered"
            className="max-lg:hidden"
            onClick={handleSaveToGitHub}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-3 mr-0.5 animate-spin" />
            ) : (
              <Upload className="size-3 mr-0.5" />
            )}
            {isSaving ? "Saving..." : "Save to GitHub"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="xs"
                variant="bordered"
                className="max-lg:hidden"
                onClick={handleSaveToLocal}
                disabled={isSavingLocal}
              >
                {isSavingLocal ? (
                  <Loader2 className="size-3 mr-0.5 animate-spin" />
                ) : (
                  <Database className="size-3 mr-0.5" />
                )}
                {isSavingLocal ? "Saving..." : "Save to Local"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Save to browser storage (IndexedDB)</p>
            </TooltipContent>
          </Tooltip>
          <Link
            href="https://discord.gg/KpanwM3vXa"
            target="_blank"
            className="max-lg:hidden"
          >
            <Button size="xs" variant="bordered">
              <HelpCircle className="size-3 mr-0.5" />
              Help
            </Button>
          </Link>
          <Link
            href="https://discord.gg/KpanwM3vXa"
            target="_blank"
            className="max-lg:hidden"
          >
            <Button
              size="xs"
              variant="bordered"
              className="!border-indigo-500 !text-white !bg-indigo-500"
            >
              <DiscordIcon className="size-3 mr-0.5" />
              Discord Community
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {project?.id && (
            <Link
              href={
                project?.private
                  ? `https://huggingface.co/spaces/${project.id}`
                  : `https://${project.id.replaceAll(
                      "/",
                      "-"
                    )}.static.hf.space`
              }
              target="_blank"
            >
              <Button
                size="xs"
                variant="bordered"
                className="flex items-center gap-1.5 justify-center bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border-emerald-500/30 text-emerald-400 hover:text-emerald-300 backdrop-blur-sm shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 max-lg:hidden font-medium"
              >
                <Eye className="size-3.5" />
                See Live Preview
                <Sparkles className="size-3" />
              </Button>
            </Link>
          )}

          {project?.private && (
            <Tooltip>
              <TooltipTrigger>
                <div className="max-lg:hidden flex items-center gap-1.5 bg-amber-500/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-500/20 shadow-lg">
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-500 text-xs font-medium tracking-wide">
                    Private Project
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  This project is private. Only you can see it.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          {user ? (
            <UserMenu className="!pl-1 !pr-3 !py-1 !h-auto" />
          ) : (
            <Button size="sm" onClick={openLoginWindow}>
              <span className="max-lg:hidden">Log In to buildflow</span>
              <span className="lg:hidden">Log In</span>
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
