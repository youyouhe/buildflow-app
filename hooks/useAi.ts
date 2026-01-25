import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState, useEffect } from "react";
import { toast } from "sonner";

import { MODELS } from "@/lib/providers";
import { useEditor } from "./useEditor";
import { Page, EnhancedSettings } from "@/types";
import { api } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "./useUser";
import { isTheSameHtml } from "@/lib/compare-html-diff";
import { getAllApiKeys } from "@/lib/indexeddb/apiKeys";
import { getSetting, setSetting } from "@/lib/indexeddb/settings";
import { decrypt } from "@/lib/crypto/encryption";

// Use the same encryption key as in api-keys.tsx
const USER_KEY = "buildflow-user-encryption-key";

export const useAi = (onScrollToBottom?: () => void) => {
  const client = useQueryClient();
  const audio = useRef<HTMLAudioElement | null>(null);
  const { setPages, setCurrentPage, setPreviewPage, setPrompts, prompts, pages, project, setProject, commits, setCommits, setLastSavedPages, isSameHtml } = useEditor();
  const [controller, setController] = useState<AbortController | null>(null);
  const router = useRouter();
  const { token } = useUser();
  const pathname = usePathname();
  const namespace = pathname.split("/")[1];
  const repoId = pathname.split("/")[2];
  const streamingPagesRef = useRef<Set<string>>(new Set());

  // One-time migration from LocalStorage to IndexedDB
  useEffect(() => {
    const migrateFromLocalStorage = async () => {
      try {
        const oldProvider = localStorage.getItem('provider');
        const oldModel = localStorage.getItem('model');
        
        if (oldProvider) {
          console.log('Migrating provider from LocalStorage to IndexedDB:', oldProvider);
          await setSetting('lastSelectedProvider', oldProvider);
          localStorage.removeItem('provider');
        }
        
        if (oldModel) {
          console.log('Migrating model from LocalStorage to IndexedDB:', oldModel);
          await setSetting('lastSelectedModel', oldModel);
          localStorage.removeItem('model');
        }
        
        if (oldProvider || oldModel) {
          console.log('✅ Migration from LocalStorage to IndexedDB completed');
          // Invalidate queries to reload from IndexedDB
          client.invalidateQueries({ queryKey: ['ai.provider'] });
          client.invalidateQueries({ queryKey: ['ai.model'] });
        }
      } catch (error) {
        console.error('Failed to migrate from LocalStorage to IndexedDB:', error);
      }
    };
    
    migrateFromLocalStorage();
  }, [client]);

  // Helper function to get decrypted API keys
  const getDecryptedApiKeys = async (): Promise<Record<string, string>> => {
    try {
      const allKeys = await getAllApiKeys();
      const decryptedKeys: Record<string, string> = {};
      
      for (const keyEntry of allKeys) {
        try {
          const decrypted = decrypt(keyEntry.encryptedKey, USER_KEY);
          if (decrypted) {
            decryptedKeys[keyEntry.provider] = decrypted;
          }
        } catch (e) {
          console.error(`Failed to decrypt key for ${keyEntry.provider}`, e);
        }
      }
      
      return decryptedKeys;
    } catch (e) {
      console.error("Failed to get API keys", e);
      return {};
    }
  };

  const { data: isAiWorking = false } = useQuery({
    queryKey: ["ai.isAiWorking"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setIsAiWorking = (newIsAiWorking: boolean) => {
    client.setQueryData(["ai.isAiWorking"], newIsAiWorking);
  };

  const { data: isThinking = false } = useQuery({
    queryKey: ["ai.isThinking"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setIsThinking = (newIsThinking: boolean) => {
    client.setQueryData(["ai.isThinking"], newIsThinking);
  };

  const { data: thinkingContent } = useQuery<string>({
    queryKey: ["ai.thinkingContent"],
    queryFn: async () => "",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: ""
  });
  const setThinkingContent = (newThinkingContent: string) => {
    client.setQueryData(["ai.thinkingContent"], newThinkingContent);
  };

  const { data: selectedElement } = useQuery<HTMLElement | null>({
    queryKey: ["ai.selectedElement"],
    queryFn: async () => null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: null
  });
  const setSelectedElement = (newSelectedElement: HTMLElement | null) => {
    client.setQueryData(["ai.selectedElement"], newSelectedElement);
    setIsEditableModeEnabled(false);
  };

  const { data: isEditableModeEnabled = false } = useQuery({
    queryKey: ["ai.isEditableModeEnabled"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setIsEditableModeEnabled = (newIsEditableModeEnabled: boolean) => {
    client.setQueryData(["ai.isEditableModeEnabled"], newIsEditableModeEnabled);
  };

  const { data: selectedFiles } = useQuery<string[]>({
    queryKey: ["ai.selectedFiles"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: []
  });
  const setSelectedFiles = (newFiles: string[]) => {
    client.setQueryData(["ai.selectedFiles"], newFiles)
  };

  const { data: contextFile } = useQuery<string | null>({
    queryKey: ["ai.contextFile"],
    queryFn: async () => null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: null
  });
  const setContextFile = (newContextFile: string | null) => {
    client.setQueryData(["ai.contextFile"], newContextFile)
  };

  const { data: provider } = useQuery({
    queryKey: ["ai.provider"],
    queryFn: async () => {
      const savedProvider = await getSetting('lastSelectedProvider');
      return savedProvider ?? "auto";
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: "auto"
  });
  const setProvider = (newProvider: string) => {
    // Update query cache immediately (sync)
    client.setQueryData(["ai.provider"], newProvider);
    // Save to IndexedDB asynchronously (fire and forget)
    setSetting('lastSelectedProvider', newProvider).catch(err => {
      console.error('Failed to save provider to IndexedDB:', err);
    });
  };

  const { data: model } = useQuery({
    queryKey: ["ai.model"],
    queryFn: async () => {
      const savedModel = await getSetting('lastSelectedModel');
      
      // Check if the model exists in the MODELS array
      const selectedModel = MODELS.find(m => m.value === savedModel || m.label === savedModel);
      if (selectedModel) {
        console.log("Using selected model:", selectedModel.value);
        return selectedModel.value;
      }
      
      // Fallback to first model if stored model doesn't exist
      console.warn("Stored model not found, using default:", MODELS[0].value);
      console.warn("Stored model was:", savedModel);
      
      // Update IndexedDB to the default model
      setSetting('lastSelectedModel', MODELS[0].value).catch(err => {
        console.error('Failed to save default model to IndexedDB:', err);
      });
      
      return MODELS[0].value;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    // Use first model as default to prevent undefined
    initialData: MODELS[0].value,
  });
  const setModel = (newModel: string) => {
    console.log("Setting new model:", newModel);
    // Update query cache immediately (sync)
    client.setQueryData(["ai.model"], newModel);
    // Save to IndexedDB asynchronously (fire and forget)
    setSetting('lastSelectedModel', newModel).catch(err => {
      console.error('Failed to save model to IndexedDB:', err);
    });
  };

  const createNewProject = async (prompt: string, htmlPages: Page[], projectName: string | undefined, isLoggedIn?: boolean, userName?: string) => {
    if (isLoggedIn && userName) {
      try {
        const uploadRequest = await fetch(`/api/me/projects/${userName}/new/update`, {
          method: "PUT",
          body: JSON.stringify({
            pages: htmlPages,
            commitTitle: prompt,
            isNew: true,
            projectName,
          }),
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        const uploadRes = await uploadRequest.json();
        
        if (!uploadRequest.ok || !uploadRes.ok) {
          throw new Error(uploadRes.error || "Failed to create project");
        }

        setIsAiWorking(false);
        router.replace(`/${uploadRes.repoId}`);
        toast.success("AI responded successfully");
        if (audio.current) audio.current.play();
      } catch (error: any) {
        setIsAiWorking(false);
        toast.error(error?.message || "Failed to create project");
      }
    } else {
      setIsAiWorking(false);
      toast.success("AI responded successfully");
      if (audio.current) audio.current.play();
    }
  }
  
  const callAiNewProject = async (prompt: string, enhancedSettings?: EnhancedSettings, redesignMarkdown?: string, isLoggedIn?: boolean, userName?: string) => {
    if (isAiWorking) return;
    if (!redesignMarkdown && !prompt.trim()) return;
    
    setIsAiWorking(true);
    setThinkingContent(""); // Reset thinking content
    streamingPagesRef.current.clear(); // Reset tracking for new generation
    
    const abortController = new AbortController();
    setController(abortController);
    
    try {
      const apiKeys = await getDecryptedApiKeys();
      
      // Debug logging
      console.log("=== callAiNewProject Debug ===");
      console.log("Provider:", provider);
      console.log("Model:", model);
      console.log("Model exists in MODELS:", !!MODELS.find(m => m.value === model));
      console.log("API Keys available:", Object.keys(apiKeys));
      console.log("===============================");
      
      const request = await fetch("/api/ask", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          provider,
          model,
          redesignMarkdown,
          enhancedSettings,
          apiKeys,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": window.location.hostname,
          "Authorization": `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      if (request && request.body) {
        const reader = request.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let contentResponse = "";

        const read = async (): Promise<any> => {
          const { done, value } = await reader.read();
          
          if (done) {
            // Final processing - extract and remove thinking content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
              contentResponse = contentResponse.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            }

            // Debug logging
            console.log("=== AI RESPONSE DEBUG ===");
            console.log("Full response length:", contentResponse.length);
            console.log("Response preview:", contentResponse.substring(0, 500));
            console.log("Has NEW_FILE_START marker:", contentResponse.includes("<<<<<<< NEW_FILE_START"));
            console.log("========================");

            const trimmedResponse = contentResponse.trim();
            if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
              try {
                const jsonResponse = JSON.parse(trimmedResponse);
                if (jsonResponse && !jsonResponse.ok) {
                  setIsAiWorking(false);
                  if (jsonResponse.openLogin) {
                    return { error: "login_required" };
                  } else if (jsonResponse.openSelectProvider) {
                    return { error: "provider_required", message: jsonResponse.message };
                  } else if (jsonResponse.openProModal) {
                    return { error: "pro_required" };
                  } else {
                    toast.error(jsonResponse.message);
                    return { error: "api_error", message: jsonResponse.message };
                  }
                }
              } catch (e) {
              }
            }
            
            const newPages = formatPages(contentResponse, false);
            console.log("Formatted pages count:", newPages.length);
            if (newPages.length > 0) {
              console.log("First page:", newPages[0]);
            }
            
            let projectName = contentResponse.match(/<<<<<<< PROJECT_NAME_START\s*([\s\S]*?)\s*>>>>>>> PROJECT_NAME_END/)?.[1]?.trim();
            if (!projectName) {
              projectName = prompt.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "-") + "-" + Math.random().toString(36).substring(2, 9);
            }
            
            // Update local state only - no auto-save to GitHub
            setPages(newPages);
            setPrompts([...prompts, prompt]);
            setIsAiWorking(false);
            
            toast.success("AI responded successfully");
            if (audio.current) audio.current.play();

            return { success: true, pages: newPages };
          }

          const chunk = decoder.decode(value, { stream: true });
          contentResponse += chunk;
          
          // Extract thinking content while streaming
          if (contentResponse.includes('</think>')) {
            // Thinking is complete, extract final content and stop thinking
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
            }
          } else if (contentResponse.includes('<think>')) {
            // Still thinking, update content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*)$/);
            if (thinkMatch) {
              const thinkingText = thinkMatch[1].trim();
              if (thinkingText) {
                setIsThinking(true);
                setThinkingContent(thinkingText);
              }
            }
          }

          const trimmedResponse = contentResponse.trim();
          if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
            try {
              const jsonResponse = JSON.parse(trimmedResponse);
              if (jsonResponse && !jsonResponse.ok) {
                setIsAiWorking(false);
                if (jsonResponse.openLogin) {
                  return { error: "login_required" };
                } else if (jsonResponse.openSelectProvider) {
                  return { error: "provider_required", message: jsonResponse.message };
                } else if (jsonResponse.openProModal) {
                  return { error: "pro_required" };
                } else {
                  toast.error(jsonResponse.message);
                  return { error: "api_error", message: jsonResponse.message };
                }
              }
            } catch (e) {
            }
          }

          // Real-time streaming update
          formatPages(contentResponse, true);
          
          return read();
        };

        return await read();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setIsAiWorking(false);
      setIsThinking(false);
      setThinkingContent("");
      setController(null);
      
      if (!abortController.signal.aborted) {
        toast.error(error.message || "Network error occurred");
      }
      
      if (error.openLogin) {
        return { error: "login_required" };
      }
      return { error: "network_error", message: error.message };
    }
  };

  const callAiFollowUp = async (prompt: string, enhancedSettings?: EnhancedSettings, isNew?: boolean) => {
    if (isAiWorking) return;
    if (!prompt.trim()) return;

    
    setIsAiWorking(true);
    setThinkingContent(""); // Reset thinking content
    
    const abortController = new AbortController();
    setController(abortController);
    
    try {
      const pagesToSend = contextFile 
        ? pages.filter(page => page.path === contextFile)
        : pages;

      const apiKeys = await getDecryptedApiKeys();

      const request = await fetch("/api/ask", {
        method: "PUT",
        body: JSON.stringify({
          prompt,
          provider,
          previousPrompts: prompts,
          model,
          pages: pagesToSend,
          selectedElementHtml: selectedElement?.outerHTML,
          files: selectedFiles,
          repoId: project?.id,
          isNew,
          enhancedSettings,
          apiKeys,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": window.location.hostname,
          "Authorization": `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      if (request && request.body) {
        const reader = request.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let contentResponse = "";
        let metadata: any = null;

        const read = async (): Promise<any> => {
          const { done, value } = await reader.read();
          
          if (done) {
            // Extract and remove thinking content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
              contentResponse = contentResponse.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            }

            // Debug logging
            console.log("=== AI FOLLOW-UP RESPONSE DEBUG ===");
            console.log("Full response length:", contentResponse.length);
            console.log("Response preview:", contentResponse.substring(0, 500));
            console.log("Has UPDATE_FILE_START marker:", contentResponse.includes("<<<<<<< UPDATE_FILE_START"));
            console.log("Has NEW_FILE_START marker:", contentResponse.includes("<<<<<<< NEW_FILE_START"));
            console.log("Pages to update:", pagesToSend.length);
            console.log("===================================");

            // const metadataMatch = contentResponse.match(/___METADATA_START___([\s\S]*?)___METADATA_END___/);
            // if (metadataMatch) {
            //   try {
            //     metadata = JSON.parse(metadataMatch[1]);
            //     contentResponse = contentResponse.replace(/___METADATA_START___[\s\S]*?___METADATA_END___/, '').trim();
            //   } catch (e) {
            //     console.error("Failed to parse metadata", e);
            //   }
            // }

            const trimmedResponse = contentResponse.trim();
            if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
              try {
                const jsonResponse = JSON.parse(trimmedResponse);
                if (jsonResponse && !jsonResponse.ok) {
                  setIsAiWorking(false);
                  if (jsonResponse.openLogin) {
                    return { error: "login_required" };
                  } else if (jsonResponse.openSelectProvider) {
                    return { error: "provider_required", message: jsonResponse.message };
                  } else if (jsonResponse.openProModal) {
                    return { error: "pro_required" };
                  } else {
                    toast.error(jsonResponse.message);
                    return { error: "api_error", message: jsonResponse.message };
                  }
                }
              } catch (e) {
                // Not JSON, continue with normal processing
              }
            }
            
            const { processAiResponse, extractProjectName } = await import("@/lib/format-ai-response");
            const { updatedPages, updatedLines } = processAiResponse(contentResponse, pagesToSend);
            
            console.log("Processed pages count:", updatedPages.length);
            if (updatedPages.length > 0) {
              console.log("First updated page:", updatedPages[0]);
            }
            
            const updatedPagesMap = new Map(updatedPages.map((p: Page) => [p.path, p]));
            const mergedPages: Page[] = pages.map(page => 
              updatedPagesMap.has(page.path) ? updatedPagesMap.get(page.path)! : page
            );
            updatedPages.forEach((page: Page) => {
              if (!pages.find(p => p.path === page.path)) {
                mergedPages.push(page);
              }
            });

            console.log("Final merged pages count:", mergedPages.length);

            // Update local state only - no auto-save to GitHub
            setPages(mergedPages);
            setPrompts([...prompts, prompt]);
            setSelectedElement(null);
            setSelectedFiles([]);
            setIsEditableModeEnabled(false);
            setIsAiWorking(false);

            toast.success("AI responded successfully");
            
            // Refresh iframe
            const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
            if (audio.current) audio.current.play();
            if (iframe) {
              setTimeout(() => {
                iframe.src = iframe.src;
              }, 500);
            }

            return { success: true, updatedLines };
          }

          const chunk = decoder.decode(value, { stream: true });
          contentResponse += chunk;
          
          // Extract thinking content while streaming
          if (contentResponse.includes('</think>')) {
            // Thinking is complete, extract final content and stop thinking
            const thinkMatch = contentResponse.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setIsThinking(false);
            }
          } else if (contentResponse.includes('<think>')) {
            // Still thinking, update content
            const thinkMatch = contentResponse.match(/<think>([\s\S]*)$/);
            if (thinkMatch) {
              const thinkingText = thinkMatch[1].trim();
              if (thinkingText) {
                setIsThinking(true);
                setThinkingContent(thinkingText);
              }
            }
          }

          // Check for error responses during streaming
          const trimmedResponse = contentResponse.trim();
          if (trimmedResponse.startsWith("{") && trimmedResponse.endsWith("}")) {
            try {
              const jsonResponse = JSON.parse(trimmedResponse);
              if (jsonResponse && !jsonResponse.ok) {
                setIsAiWorking(false);
                if (jsonResponse.openLogin) {
                  return { error: "login_required" };
                } else if (jsonResponse.openSelectProvider) {
                  return { error: "provider_required", message: jsonResponse.message };
                } else if (jsonResponse.openProModal) {
                  return { error: "pro_required" };
                } else {
                  toast.error(jsonResponse.message);
                  return { error: "api_error", message: jsonResponse.message };
                }
              }
            } catch (e) {
              // Not complete JSON yet, continue
            }
          }
          
          return read();
        };

        return await read();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setIsAiWorking(false);
      setIsThinking(false);
      setThinkingContent("");
      setController(null);
      
      if (!abortController.signal.aborted) {
        toast.error(error.message || "Network error occurred");
      }
      
      if (error.openLogin) {
        return { error: "login_required" };
      }
      return { error: "network_error", message: error.message };
    }
  };

  const formatPages = (content: string, isStreaming: boolean = true) => {
    console.log("=== FORMAT PAGES DEBUG ===");
    console.log("Content length:", content.length);
    console.log("Is streaming:", isStreaming);
    console.log("Has marker:", content.match(/<<<<<<< NEW_FILE_START[\s\S]*?>>>>>>> NEW_FILE_END/) !== null);
    
    const pages: Page[] = [];
    if (!content.match(/<<<<<<< NEW_FILE_START[\s\S]*?>>>>>>> NEW_FILE_END/)) {
      console.log("⚠️ No NEW_FILE_START markers found, returning empty array");
      console.log("Content preview:", content.substring(0, 300));
      console.log("=========================");
      return pages;
    }

    console.log("✓ Found NEW_FILE_START markers, processing...");

    const cleanedContent = content.replace(
      /[\s\S]*?<<<<<<< NEW_FILE_START\s+([\s\S]*?)\s+>>>>>>> NEW_FILE_END/,
      "<<<<<<< NEW_FILE_START $1 >>>>>>> NEW_FILE_END"
    );
    const fileChunks = cleanedContent.split(
      /<<<<<<< NEW_FILE_START\s+([\s\S]*?)\s+>>>>>>> NEW_FILE_END/
    );
    console.log("File chunks count:", fileChunks.length);
    
    const processedChunks = new Set<number>();

    fileChunks.forEach((chunk, index) => {
      if (processedChunks.has(index) || !chunk?.trim()) {
        return;
      }
      const filePath = chunk.trim();
      const fileContent = extractFileContent(fileChunks[index + 1], filePath);

      console.log(`Processing file ${index}: ${filePath}, content length: ${fileContent?.length || 0}`);

      if (fileContent) {
        const page: Page = {
          path: filePath,
          html: fileContent,
        };
        pages.push(page);

        if (fileContent.length > 200) {
          onScrollToBottom?.();
        }

        processedChunks.add(index);
        processedChunks.add(index + 1);
      }
    });
    
    console.log("Total pages formatted:", pages.length);
    console.log("=========================");
    
    if (pages.length > 0) {
      setPages(pages);
      if (isStreaming) {
        const newPages = pages.filter(p => 
          !streamingPagesRef.current.has(p.path)
        );
        
        if (newPages.length > 0) {
          const newPage = newPages[0];
          setCurrentPage(newPage.path);
          streamingPagesRef.current.add(newPage.path);
          
          if (newPage.path.endsWith('.html') && !newPage.path.includes('/components/')) {
            setPreviewPage(newPage.path);
          }
        }
      } else {
        streamingPagesRef.current.clear();
        const indexPage = pages.find(p => p.path === 'index.html' || p.path === 'index' || p.path === '/');
        if (indexPage) {
          setCurrentPage(indexPage.path);
        }
      }
    }

    return pages;
  };

  const extractFileContent = (chunk: string, filePath: string): string => {
    if (!chunk) return "";
    
    let content = chunk.trim();
    
    if (filePath.endsWith('.css')) {
      const cssMatch = content.match(/```css\s*([\s\S]*?)\s*```/);
      if (cssMatch) {
        content = cssMatch[1];
      } else {
        content = content.replace(/^```css\s*/i, "");
      }
      return content.replace(/```/g, "").trim();
    } else if (filePath.endsWith('.js')) {
      const jsMatch = content.match(/```(?:javascript|js)\s*([\s\S]*?)\s*```/);
      if (jsMatch) {
        content = jsMatch[1];
      } else {
        // If no closing backticks found, the code block might be incomplete
        // Check if we have opening backticks but no closing ones
        const hasOpening = content.match(/^```(?:javascript|js)/i);
        if (hasOpening && !content.includes('```', 3)) {
          // Incomplete code block during streaming - return empty to skip injection
          return "";
        }
        content = content.replace(/^```(?:javascript|js)\s*/i, "");
      }
      return content.replace(/```/g, "").trim();
    } else {
      const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/);
      if (htmlMatch) {
        content = htmlMatch[1];
      } else {
        content = content.replace(/^```html\s*/i, "");
        const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*/);
        if (doctypeMatch) {
          content = doctypeMatch[0];
        }
      }
      
      let htmlContent = content.replace(/```/g, "");
      htmlContent = ensureCompleteHtml(htmlContent);
      return htmlContent;
    }
  };

  const ensureCompleteHtml = (html: string): string => {
    let completeHtml = html;
    if (completeHtml.includes("<head>") && !completeHtml.includes("</head>")) {
      completeHtml += "\n</head>";
    }
    if (completeHtml.includes("<body") && !completeHtml.includes("</body>")) {
      completeHtml += "\n</body>";
    }
    if (!completeHtml.includes("</html>")) {
      completeHtml += "\n</html>";
    }
    return completeHtml;
  };

  const cancelRequest = () => {
    if (controller) {
      controller.abort();
      setController(null);
    }
    setIsAiWorking(false);
    setIsThinking(false);
  };

  const selectedModel = useMemo(() => {
    return MODELS.find(m => m.value === model || m.label === model);
  }, [model]);

  return {
    isThinking,
    setIsThinking,
    thinkingContent,
    setThinkingContent,
    callAiNewProject,
    callAiFollowUp,
    isAiWorking,
    setIsAiWorking,
    selectedElement,
    setSelectedElement,
    selectedFiles,
    setSelectedFiles,
    contextFile,
    setContextFile,
    isEditableModeEnabled,
    setIsEditableModeEnabled,
    globalAiLoading: isThinking || isAiWorking,
    cancelRequest,
    model,
    setModel,
    provider,
    setProvider,
    selectedModel,
    audio,
  };
}