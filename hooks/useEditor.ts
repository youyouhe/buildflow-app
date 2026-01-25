import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { useUpdateEffect } from "react-use";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { defaultHTML } from "@/lib/consts";
import { Commit, Page, Project, EditorProject } from "@/types";
import { api } from "@/lib/api";
import { isTheSameHtml } from "@/lib/compare-html-diff";
import { getProject } from "@/lib/indexeddb/projects";
import { decompress } from "@/lib/compression";

export const useEditor = (namespace?: string, repoId?: string) => {
  const client = useQueryClient();
  const router = useRouter();

  const isLocalProject = namespace === "local";

  const { data: project, isFetching: isLoadingProject } = useQuery<EditorProject | null>({
    queryKey: ["editor.project", namespace, repoId],
    queryFn: async () => {
      try {
        // Handle local IndexedDB projects
        if (isLocalProject && repoId) {
          const localProject = await getProject(repoId);
          if (!localProject) {
            toast.error("Project not found in local storage");
            router.push("/");
            return null;
          }
          // Convert to EditorProject format
          return {
            id: localProject.id,
            name: localProject.title,
            fullName: localProject.title,
            description: localProject.description,
            private: true,
            owner: "local",
            url: "",
            defaultBranch: "main",
          };
        }
        
        // Handle GitHub projects
        if (namespace && repoId) {
          const response = await api.get(`/github/repos/${namespace}/${repoId}`);
          const repo = response.data;
          // Return a project object compatible with the editor
          return {
            id: repo.id.toString(),
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            private: repo.private,
            owner: repo.owner.login,
            url: repo.html_url,
            defaultBranch: repo.default_branch,
          };
        }
        
        // No project (new page)
        return null;
      } catch (error: any) {
        toast.error(error.response?.data?.error || "Failed to load project");
        router.push("/");
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: 0,
    gcTime: 0,
  });
  const setProject = (newProject: any) => {
    const { project, pages, files, commits } = newProject;
    if (pages?.length > 0) {
      setPages(pages);
    }
    if (files?.length > 0) {
      setFiles(files);
    }
    if (commits?.length > 0) {
      setCommits(commits);
    }
    client.setQueryData(["editor.project", namespace, repoId], project);
  };

  const { data: pages = [], isLoading: isLoadingPages, isFetching: isFetchingPages } = useQuery<Page[]>({
    queryKey: ["editor.pages", namespace, repoId],
    queryFn: async (): Promise<Page[]> => {
      // Load pages from IndexedDB for local projects
      if (isLocalProject && repoId) {
        const localProject = await getProject(repoId);
        
        if (localProject?.files) {
          const loadedPages = localProject.files.map(file => {
            // Decompress content if it was compressed
            const content = file.compressed 
              ? decompress(file.content)
              : file.content;
            
            return {
              path: file.path,
              html: content,
            };
          });
          return loadedPages;
        }
      }
      
      // Default pages for new or empty projects
      return [
        {
          path: "index.html",
          html: defaultHTML,
        },
      ];
    },
    // Always enabled, let queryKey handle cache separation
    enabled: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    staleTime: Infinity, // Keep data fresh indefinitely
    gcTime: Infinity, // Never garbage collect
    initialData: undefined,
    placeholderData: undefined,
  });
  
  // Debug: Log when pages data actually changes
  useUpdateEffect(() => {
    if (pages.length > 0) {
      console.log('[useEditor] 📊 pages state updated:', pages.map(p => ({ path: p.path, htmlLength: p.html?.length })));
    }
  }, [pages]);
  const setPages = (newPages: Page[] | ((prev: Page[]) => Page[])) => {
    const queryKey = ["editor.pages", namespace, repoId];
    if (typeof newPages === "function") {
      const currentPages = client.getQueryData<Page[]>(queryKey) ?? [];
      const updatedPages = newPages(currentPages);
      client.setQueryData(queryKey, updatedPages);
    } else {
      client.setQueryData(queryKey, newPages);
    }
  };

  const { data: currentPage = "index.html" } = useQuery({
    queryKey: ["editor.currentPage"],
    queryFn: async () => "index.html",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setCurrentPage = (newCurrentPage: string) => {
    client.setQueryData(["editor.currentPage"], newCurrentPage);
  };

  const { data: previewPage = "" } = useQuery({
    queryKey: ["editor.previewPage"],
    queryFn: async () => "",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setPreviewPage = (newPreviewPage: string) => {
    client.setQueryData(["editor.previewPage"], newPreviewPage);
  };

  const { data: prompts = [] } = useQuery({
    queryKey: ["editor.prompts", namespace, repoId],
    queryFn: async () => {
      // Load prompts from IndexedDB for local projects
      if (isLocalProject && repoId) {
        const localProject = await getProject(repoId);
        if (localProject?.prompts) {
          return localProject.prompts.map(p => p.content);
        }
      }
      return [];
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    // Only use initialData when there's no namespace/repoId
    initialData: (!namespace && !repoId) ? [] : undefined,
    placeholderData: [],
  });
  const setPrompts = (newPrompts: string[] | ((prev: string[]) => string[])) => {
    const queryKey = ["editor.prompts", namespace, repoId];
    if (typeof newPrompts === "function") {
      const currentPrompts = client.getQueryData<string[]>(queryKey) ?? [];
      client.setQueryData(queryKey, newPrompts(currentPrompts));
    } else {
      client.setQueryData(queryKey, newPrompts);
    }
  };

  const { data: files = [] } = useQuery({
    queryKey: ["editor.files"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    initialData: [],
  });
  const setFiles = (newFiles: string[] | ((prev: string[]) => string[])) => {
    if (typeof newFiles === "function") {
      const currentFiles = client.getQueryData<string[]>(["editor.files"]) ?? [];
      client.setQueryData(["editor.files"], newFiles(currentFiles));
    } else {
      client.setQueryData(["editor.files"], newFiles);
    }
  };

  const { data: commits = [] } = useQuery({
    queryKey: ["editor.commits"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: [],
  });
  const setCommits = (newCommits: Commit[] | ((prev: Commit[]) => Commit[])) => {
    if (typeof newCommits === "function") {
      const currentCommits = client.getQueryData<Commit[]>(["editor.commits"]) ?? [];
      client.setQueryData(["editor.commits"], newCommits(currentCommits));
    } else {
      client.setQueryData(["editor.commits"], newCommits);
    }
  };

  const { data: device = "desktop" } = useQuery<string>({
    queryKey: ["editor.device"],
    queryFn: async () => "desktop",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: "desktop",
  });
  const setDevice = (newDevice: string | ((prev: string) => string)) => {
    client.setQueryData(["editor.device"], newDevice);
  };

  const { data: currentTab = "chat" } = useQuery({
    queryKey: ["editor.currentTab"],
    queryFn: async () => "chat",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setCurrentTab = (newCurrentTab: string | ((prev: string) => string)) => {
    client.setQueryData(["editor.currentTab"], newCurrentTab);
  };

  const { data: currentCommit = null } = useQuery<string | null>({
    queryKey: ["editor.currentCommit"],
    queryFn: async () => null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setCurrentCommit = (newCurrentCommit: string | null) => {
    client.setQueryData(["editor.currentCommit"], newCurrentCommit);
  };

  const currentPageData = useMemo(() => {
    const found = pages.find((page) => page.path === currentPage);
    return found ?? { path: "index.html", html: defaultHTML };
  }, [pages, currentPage]);

  const uploadFilesMutation = useMutation({
    mutationFn: async ({ files, project }: { files: FileList; project: EditorProject }) => {
      const mediaFiles = Array.from(files).filter((file) => {
        return file.type.startsWith("image/") || 
               file.type.startsWith("video/") || 
               file.type.startsWith("audio/");
      });

      const data = new FormData();
      mediaFiles.forEach((file) => {
        data.append("images", file); // Keep using "images" key for backward compatibility
      });

      const response = await api.post(
        `/me/projects/${project.id}/images`,
        data
      );

      if (!response.data.ok) {
        throw new Error('Upload failed');
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      setFiles((prev) => [...prev, ...data.uploadedFiles]);
    },
  });

  const uploadFiles = (files: FileList | null, project: EditorProject) => {
    if (!files || !project) return;
    uploadFilesMutation.mutate({ files, project });
  };

  // Unsaved changes tracking
  const { data: lastSavedPages = [] } = useQuery<Page[]>({
    queryKey: ["editor.lastSavedPages"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: [],
  });
  const setLastSavedPages = (newPages: Page[]) => {
    client.setQueryData(["editor.lastSavedPages"], newPages);
  };

  // Preview refresh key
  const { data: previewKey = 0 } = useQuery<number>({
    queryKey: ["editor.previewKey"],
    queryFn: async () => 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: 0,
  });
  const refreshPreview = () => {
    client.setQueryData(["editor.previewKey"], (prev: number = 0) => prev + 1);
  };

  // Preview iframe ref (shared across components for screenshot)
  const { data: previewIframeRef = { current: null } } = useQuery<{ current: HTMLIFrameElement | null }>({
    queryKey: ["editor.previewIframeRef"],
    queryFn: async () => ({ current: null }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: { current: null },
  });
  const setPreviewIframeRef = (ref: HTMLIFrameElement | null) => {
    client.setQueryData(["editor.previewIframeRef"], { current: ref });
  };

  const { data: hasUnsavedChanges = false } = useQuery({
    queryKey: ["editor.hasUnsavedChanges"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setHasUnsavedChanges = (hasChanges: boolean) => {
    client.setQueryData(["editor.hasUnsavedChanges"], hasChanges);
  };

  // Save changes mutation
  const saveChangesMutation = useMutation({
    mutationFn: async ({ pages, project, namespace, repoId }: { pages: Page[]; project: any; namespace?: string; repoId?: string }) => {
      if (!project?.id || !namespace || !repoId) {
        throw new Error("Project not found or missing parameters");
      }

      // Handle local projects - save to IndexedDB
      if (namespace === "local") {
        const { updateProject } = await import("@/lib/indexeddb/projects");
        
        const files = pages.map(page => ({
          path: page.path,
          content: page.html || "",
          language: page.path.endsWith('.html') ? 'html' : 
                    page.path.endsWith('.css') ? 'css' : 
                    page.path.endsWith('.js') ? 'javascript' : 'text',
          size: (page.html || "").length,
        }));

        const updated = await updateProject(repoId, { files });
        
        if (!updated) {
          throw new Error("Failed to update local project");
        }

        return { ok: true, message: "Saved to local storage" };
      }

      // Handle GitHub projects - save to API
      const response = await api.put(`/me/projects/${namespace}/${repoId}/save`, {
        pages,
        commitTitle: "Manual changes saved"
      });

      if (!response.data.ok) {
        throw new Error(response.data.message || "Failed to save changes");
      }

      return response.data;
    },
    onSuccess: (data) => {
      setLastSavedPages([...pages]);
      setHasUnsavedChanges(false);
      if (data.commit) {
        setCommits((prev) => [data.commit, ...prev]);
      }
      toast.success("Changes saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save changes");
    },
  });

  const saveChanges = async () => {
    if (!project || !hasUnsavedChanges || !namespace || !repoId) return;
    return saveChangesMutation.mutateAsync({ pages, project, namespace, repoId });
  };

  // Check for unsaved changes when pages change
  const checkForUnsavedChanges = () => {
    if (pages.length === 0 || lastSavedPages.length === 0) return;
    
    const hasChanges = JSON.stringify(pages) !== JSON.stringify(lastSavedPages);
    setHasUnsavedChanges(hasChanges);
  };
  // Check for changes when pages change
  useUpdateEffect(() => {
    if (lastSavedPages.length > 0) {
      checkForUnsavedChanges();
    }
  }, [pages, lastSavedPages]);

  // NOTE: Removed the namespace/repoId invalidation effect as it causes issues
  // when switching between routes. TanStack Query will automatically handle
  // cache invalidation based on queryKey changes.

  const isSameHtml = useMemo(() => {
    return isTheSameHtml(currentPageData.html);
  }, [pages]);

  return {
    isLoadingProject,
    isLoadingPages,
    isFetchingPages,
    project,
    prompts,
    pages,
    setPages,
    setPrompts,
    files,
    setFiles,
    device,
    setDevice,
    currentPage,
    setCurrentPage,
    previewPage,
    setPreviewPage,
    currentPageData,
    currentTab,
    setCurrentTab,
    uploadFiles,
    commits,
    setCommits,
    currentCommit,
    setCurrentCommit,
    setProject,
    isSameHtml,
    isUploading: uploadFilesMutation.isPending,
    globalEditorLoading: uploadFilesMutation.isPending || isLoadingProject,
    // Unsaved changes functionality
    hasUnsavedChanges,
    saveChanges,
    isSaving: saveChangesMutation.isPending,
    lastSavedPages,
    setLastSavedPages,
    // Preview refresh
    previewKey,
    refreshPreview,
    // Preview iframe ref (for screenshot)
    previewIframeRef,
    setPreviewIframeRef,
  };
};
