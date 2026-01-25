"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useUpdateEffect } from "react-use";
import classNames from "classnames";

import { cn } from "@/lib/utils";
import { GridPattern } from "@/components/magic-ui/grid-pattern";
import { useEditor } from "@/hooks/useEditor";
import { useAi } from "@/hooks/useAi";
import { htmlTagToText } from "@/lib/html-tag-to-text";
import { AnimatedBlobs } from "@/components/animated-blobs";
import { AiLoading } from "../ask-ai/loading";
import { defaultHTML } from "@/lib/consts";
import { HistoryNotification } from "../history-notification";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCcw, TriangleAlert } from "lucide-react";
import { Page } from "@/types";
import { validateJavaScriptDetailed } from "@/lib/validate-js";

export const Preview = ({
  isNew,
  namespace,
  repoId,
}: {
  isNew: boolean;
  namespace?: string;
  repoId?: string;
}) => {
  const {
    project,
    device,
    isLoadingProject,
    currentTab,
    currentCommit,
    setCurrentCommit,
    currentPageData,
    pages,
    setPages,
    setCurrentPage,
    previewPage,
    setPreviewPage,
    setLastSavedPages,
    hasUnsavedChanges,
    previewKey,
    refreshPreview,
    setPreviewIframeRef,
  } = useEditor(namespace, repoId); // CRITICAL FIX: Pass namespace and repoId!
  const {
    isEditableModeEnabled,
    setSelectedElement,
    isAiWorking,
    globalAiLoading,
  } = useAi();

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [hoveredElement, setHoveredElement] = useState<{
    tagName: string;
    rect: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const [isPromotingVersion, setIsPromotingVersion] = useState(false);
  const [stableHtml, setStableHtml] = useState<string>("");
  const [throttledHtml, setThrottledHtml] = useState<string>("");
  const lastUpdateTimeRef = useRef<number>(0);
  const [commitPages, setCommitPages] = useState<Page[]>([]);
  const [isLoadingCommitPages, setIsLoadingCommitPages] = useState(false);
  const prevCommitRef = useRef<string | null>(null);
  const prevStableHtmlLengthRef = useRef<number>(0);

  useEffect(() => {
    if (!previewPage && pages.length > 0) {
      const indexPage = pages.find(
        (p) => p.path === "index.html" || p.path === "index" || p.path === "/"
      );
      const firstHtmlPage = pages.find((p) => p.path.endsWith(".html"));
      const newPreviewPage = indexPage?.path || firstHtmlPage?.path || "index.html";
      setPreviewPage(newPreviewPage);
    }
  }, [pages, previewPage, setPreviewPage]);

  const pagesToUse = currentCommit ? commitPages : pages;

  const previewPageData = useMemo(() => {
    const found = pagesToUse.find((p) => {
      const normalizedPagePath = p.path.replace(/^\.?\//, "");
      const normalizedPreviewPage = previewPage.replace(/^\.?\//, "");
      return normalizedPagePath === normalizedPreviewPage;
    });
    
    const result = found || (pagesToUse.length > 0 ? pagesToUse[0] : currentPageData);
    
    // Auto-set previewPage if it's empty and we have pages
    if (!previewPage && pagesToUse.length > 0) {
      const indexPage = pagesToUse.find(
        (p) => p.path === "index.html" || p.path === "index" || p.path === "/"
      );
      const firstHtmlPage = pagesToUse.find((p) => p.path.endsWith(".html"));
      const autoPreviewPage = indexPage?.path || firstHtmlPage?.path || pagesToUse[0].path;
      // Use setTimeout to avoid setState during render
      setTimeout(() => setPreviewPage(autoPreviewPage), 0);
    }
    
    return result;
  }, [pagesToUse, previewPage, currentPageData, setPreviewPage]);

  // Fetch commit pages when currentCommit changes
  useEffect(() => {
    if (currentCommit && namespace && repoId) {
      setIsLoadingCommitPages(true);
      api
        .get(`/me/projects/${namespace}/${repoId}/commits/${currentCommit}`)
        .then((res) => {
          if (res.data.ok) {
            setCommitPages(res.data.pages);
            // Set preview page to index.html if available
            const indexPage = res.data.pages.find(
              (p: Page) =>
                p.path === "index.html" || p.path === "index" || p.path === "/"
            );
            if (indexPage) {
              setPreviewPage(indexPage.path);
            }
            // Refresh iframe to show commit version
            refreshPreview();
          }
        })
        .catch((err) => {
          toast.error(
            err.response?.data?.error || "Failed to fetch commit pages"
          );
        })
        .finally(() => {
          setIsLoadingCommitPages(false);
        });
    } else if (!currentCommit && prevCommitRef.current !== null) {
      // Only clear commitPages when transitioning from a commit to no commit
      setCommitPages([]);
    }
    prevCommitRef.current = currentCommit;
  }, [currentCommit, namespace, repoId]);

  // Create navigation interception script
  const createNavigationScript = useCallback((availablePages: Page[]) => {
    const pagePaths = availablePages.map((p) => p.path.replace(/^\.?\//, ""));
    
    // Safely stringify the page paths
    let pagesJson;
    try {
      pagesJson = JSON.stringify(pagePaths);
      // Validate that the JSON is actually valid
      JSON.parse(pagesJson); // This will throw if invalid
    } catch (e) {
      console.error("Failed to stringify page paths:", e, "Pages:", availablePages);
      pagesJson = "[]";
    }
    
    const script = `(function() {
  const availablePages = ${pagesJson};
  
  function normalizePath(path) {
    let normalized = path.replace(/^\\.?\\//g, "");
    if (normalized === "" || normalized === "/") {
      normalized = "index.html";
    }
    const hashIndex = normalized.indexOf("#");
    if (hashIndex !== -1) {
      normalized = normalized.substring(0, hashIndex);
    }
    if (!normalized.includes(".")) {
      normalized = normalized + ".html";
    }
    return normalized;
  }
  
  function handleNavigation(url) {
    if (!url) return;
    
    if (url.startsWith("#")) {
      const targetElement = document.querySelector(url);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
      const searchInShadows = function(root) {
        const elements = root.querySelectorAll("*");
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.shadowRoot) {
            const found = el.shadowRoot.querySelector(url);
            if (found) {
              found.scrollIntoView({ behavior: "smooth" });
              return;
            }
            searchInShadows(el.shadowRoot);
          }
        }
      };
      searchInShadows(document);
      return;
    }
    
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
      window.open(url, "_blank");
      return;
    }
    
    const normalizedPath = normalizePath(url);
    if (availablePages.includes(normalizedPath)) {
      window.parent.postMessage({ type: "navigate", path: normalizedPath }, "*");
    } else {
      console.warn("Page not found:", normalizedPath);
    }
  }
  
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  
  window.location.assign = function(url) {
    handleNavigation(url);
  };
  
  window.location.replace = function(url) {
    handleNavigation(url);
  };
  
  try {
    let currentHref = window.location.href;
    Object.defineProperty(window.location, "href", {
      get: function() {
        return currentHref;
      },
      set: function(url) {
        handleNavigation(url);
      },
      configurable: true
    });
  } catch (e) {
    console.warn("Could not intercept location.href:", e);
  }
  
  document.addEventListener("click", function(e) {
    const anchor = e.target.closest("a");
    if (anchor && anchor.href) {
      const href = anchor.getAttribute("href");
      if (href && !href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("//") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
        e.preventDefault();
        handleNavigation(href);
      }
    }
  }, true);
  
  document.addEventListener("submit", function(e) {
    const form = e.target;
    if (form.action && !form.action.startsWith("http://") && !form.action.startsWith("https://") && !form.action.startsWith("//")) {
      e.preventDefault();
      handleNavigation(form.action);
    }
  }, true);
})();`;
    
    // Validate the generated script
    const validation = validateJavaScriptDetailed(script);
    if (!validation.valid) {
      console.error(
        '[Preview] Invalid navigation script generated:',
        validation.error,
        '\nScript preview:',
        script.substring(0, 300)
      );
      // Return a minimal safe script
      return `(function() { console.log('Navigation script disabled due to error'); })();`;
    }
    
    return script;
  }, []);

  const injectAssetsIntoHtml = useCallback(
    (html: string, pagesToUse: Page[] = pages): string => {
      if (!html) return html;

      try {
        const cssFiles = pagesToUse.filter(
          (p) => p.path.endsWith(".css") && p.path !== previewPageData?.path
        );
        const jsFiles = pagesToUse.filter(
          (p) => p.path.endsWith(".js") && p.path !== previewPageData?.path
        );
        const jsonFiles = pagesToUse.filter(
          (p) => p.path.endsWith(".json") && p.path !== previewPageData?.path
        );

        let modifiedHtml = html;

      // Inject navigation script for srcDoc
      const navigationScript = createNavigationScript(pagesToUse);

      // Inject all CSS files
      if (cssFiles.length > 0) {
        const allCssContent = cssFiles
          .map((file) => {
            const content = (file.html || file.content || "").trim();
            if (!content) return "";
            return `<style data-injected-from="${file.path}">\n${content}\n</style>`;
          })
          .filter(Boolean)
          .join("\n");

        if (modifiedHtml.includes("</head>")) {
          modifiedHtml = modifiedHtml.replace(
            "</head>",
            `${allCssContent}\n</head>`
          );
        } else if (modifiedHtml.includes("<head>")) {
          modifiedHtml = modifiedHtml.replace(
            "<head>",
            `<head>\n${allCssContent}`
          );
        } else {
          modifiedHtml = allCssContent + "\n" + modifiedHtml;
        }

        cssFiles.forEach((file) => {
          const escapedPath = file.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          modifiedHtml = modifiedHtml.replace(
            new RegExp(
              `<link\\s+[^>]*href=["'][\\.\/]*${escapedPath}["'][^>]*>`,
              "gi"
            ),
            ""
          );
        });
      }

      if (jsFiles.length > 0) {
        const allJsContent = jsFiles
          .map((file) => {
            // Ensure the script content is properly escaped
            const content = (file.html || file.content || "").trim();
            if (!content) return "";
            
            // Validate JavaScript syntax before injection
            const validation = validateJavaScriptDetailed(content);
            if (!validation.valid) {
              console.error(
                `[Preview] Invalid JavaScript in ${file.path}:`,
                validation.error,
                '\nProblematic code:',
                content.substring(0, 200) + (content.length > 200 ? '...' : '')
              );
              // Skip this file to prevent syntax errors in preview
              return "";
            }
            
            return `<script data-injected-from="${file.path}">\n${content}\n</script>`;
          })
          .filter(Boolean)
          .join("\n");

        if (modifiedHtml.includes("</body>")) {
          modifiedHtml = modifiedHtml.replace(
            "</body>",
            `${allJsContent}\n</body>`
          );
        } else if (modifiedHtml.includes("<body>")) {
          modifiedHtml = modifiedHtml + allJsContent;
        } else {
          modifiedHtml = modifiedHtml + "\n" + allJsContent;
        }

        jsFiles.forEach((file) => {
          const escapedPath = file.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          modifiedHtml = modifiedHtml.replace(
            new RegExp(
              `<script\\s+[^>]*src=["'][\\.\/]*${escapedPath}["'][^>]*><\\/script>`,
              "gi"
            ),
            ""
          );
        });
      }

      // Inject all JSON files as script tags with type="application/json"
      if (jsonFiles.length > 0) {
        const allJsonContent = jsonFiles
          .map((file) => {
            let content = (file.html || file.content || "").trim();
            if (!content) return "";
            
            // Validate and format JSON
            try {
              const parsed = JSON.parse(content);
              content = JSON.stringify(parsed, null, 2);
            } catch (e) {
              console.warn(`Invalid JSON in ${file.path}:`, e);
              return "";
            }
            
            return `<script type="application/json" data-injected-from="${
              file.path
            }" id="${file.path.replace(/[^a-zA-Z0-9]/g, "-")}">\n${content}\n</script>`;
          })
          .filter(Boolean)
          .join("\n");

        if (modifiedHtml.includes("</body>")) {
          modifiedHtml = modifiedHtml.replace(
            "</body>",
            `${allJsonContent}\n</body>`
          );
        } else if (modifiedHtml.includes("<body>")) {
          modifiedHtml = modifiedHtml + allJsonContent;
        } else {
          modifiedHtml = modifiedHtml + "\n" + allJsonContent;
        }

        jsonFiles.forEach((file) => {
          const escapedPath = file.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          modifiedHtml = modifiedHtml.replace(
            new RegExp(
              `<script\\s+[^>]*src=["'][\\.\/]*${escapedPath}["'][^>]*><\\/script>`,
              "gi"
            ),
            ""
          );
        });
      }

      // Inject navigation script early in the document
      if (navigationScript) {
        // Try to inject right after <head> or <body> opening tag
        if (modifiedHtml.includes("<head>")) {
          modifiedHtml = modifiedHtml.replace(
            "<head>",
            `<head>\n<script data-navigation-script>\n${navigationScript}\n</script>`
          );
        } else if (modifiedHtml.includes("<body>")) {
          modifiedHtml = modifiedHtml.replace(
            "<body>",
            `<body>\n<script data-navigation-script>\n${navigationScript}\n</script>`
          );
        } else if (modifiedHtml.includes("</body>")) {
          modifiedHtml = modifiedHtml.replace(
            "</body>",
            `<script data-navigation-script>\n${navigationScript}\n</script>\n</body>`
          );
        } else {
          modifiedHtml =
            `<script data-navigation-script>\n${navigationScript}\n</script>\n` + modifiedHtml;
        }
      }

      return modifiedHtml;
      } catch (error) {
        console.error("Error injecting assets into HTML:", error);
        // Return original HTML if injection fails
        return html;
      }
    },
    [pages, previewPageData?.path, createNavigationScript]
  );

  useEffect(() => {
    if (isNew && previewPageData?.html) {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

      if (lastUpdateTimeRef.current === 0 || timeSinceLastUpdate >= 3000) {
        const processedHtml = injectAssetsIntoHtml(
          previewPageData.html,
          pagesToUse
        );
        setThrottledHtml(processedHtml);
        lastUpdateTimeRef.current = now;
      } else {
        const timeUntilNextUpdate = 3000 - timeSinceLastUpdate;
        const timer = setTimeout(() => {
          const processedHtml = injectAssetsIntoHtml(
            previewPageData.html,
            pagesToUse
          );
          setThrottledHtml(processedHtml);
          lastUpdateTimeRef.current = Date.now();
        }, timeUntilNextUpdate);
        return () => clearTimeout(timer);
      }
    }
  }, [isNew, previewPageData?.html, injectAssetsIntoHtml, pagesToUse]);

  // Update stableHtml when content changes or AI is done working
  useEffect(() => {
    if (!isAiWorking && !globalAiLoading && previewPageData?.html) {
      const processedHtml = injectAssetsIntoHtml(
        previewPageData.html,
        pagesToUse
      );
      setStableHtml(processedHtml);
      
      // Force iframe refresh when stableHtml changes from empty to content (loaded project)
      if (!isNew && processedHtml && prevStableHtmlLengthRef.current === 0) {
        refreshPreview();
      }
      prevStableHtmlLengthRef.current = processedHtml.length;
    }
  }, [
    isAiWorking,
    globalAiLoading,
    previewPageData?.html,
    injectAssetsIntoHtml,
    previewPage,
    pagesToUse,
    isNew,
    refreshPreview,
  ]);

  // Debug: log the actual srcDoc value being used
  const srcDocValue = useMemo(() => {
    const value = currentCommit
      ? undefined
      : isNew ||
        hasUnsavedChanges ||
        project?.private ||
        !project?.id
      ? isNew
        ? throttledHtml || defaultHTML
        : stableHtml || defaultHTML
      : stableHtml || defaultHTML;
    
    return value;
  }, [currentCommit, isNew, hasUnsavedChanges, project?.private, project?.id, throttledHtml, stableHtml, previewPageData]);

  const setupIframeListeners = () => {
    if (iframeRef?.current?.contentDocument) {
      try {
        const iframeDocument = iframeRef.current.contentDocument;
        
        // Only add listeners if document is fully loaded and accessible
        if (iframeDocument && iframeDocument.body) {
          iframeDocument.addEventListener(
            "click",
            handleCustomNavigation as any,
            true
          );

          if (isEditableModeEnabled) {
            iframeDocument.addEventListener("mouseover", handleMouseOver);
            iframeDocument.addEventListener("mouseout", handleMouseOut);
            iframeDocument.addEventListener("click", handleClick);
          }
        }
      } catch (error) {
        // Ignore errors if document is not accessible
        console.debug("Could not setup iframe listeners:", error);
      }
    }
  };

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "navigate" && event.data?.path) {
        setPreviewPage(event.data.path);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setPreviewPage]);

  useEffect(() => {
    const cleanupListeners = () => {
      // Check if iframe and its contentDocument still exist before cleanup
      if (iframeRef?.current?.contentDocument) {
        try {
          const iframeDocument = iframeRef.current.contentDocument;
          
          // Only remove listeners if the document is still accessible
          if (iframeDocument && iframeDocument.body) {
            iframeDocument.removeEventListener(
              "click",
              handleCustomNavigation as any,
              true
            );
            iframeDocument.removeEventListener("mouseover", handleMouseOver);
            iframeDocument.removeEventListener("mouseout", handleMouseOut);
            iframeDocument.removeEventListener("click", handleClick);
          }
        } catch (error) {
          // Ignore errors if document is no longer accessible
          console.debug("Could not cleanup iframe listeners:", error);
        }
      }
    };

    const timer = setTimeout(() => {
      if (iframeRef?.current?.contentDocument) {
        cleanupListeners();
        setupIframeListeners();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      cleanupListeners();
    };
  }, [isEditableModeEnabled, stableHtml, throttledHtml, previewPage]);

  // Sync iframe ref to global state for screenshot functionality
  // Only update when previewKey changes (iframe remounts)
  useEffect(() => {
    if (iframeRef.current) {
      setPreviewIframeRef(iframeRef.current);
    }
    // Cleanup when component unmounts or previewKey changes
    return () => {
      setPreviewIframeRef(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]); // Only re-run when iframe remounts (previewKey changes)

  const promoteVersion = async () => {
    setIsPromotingVersion(true);
    await api
      .post(
        `/me/projects/${project?.id}/commits/${currentCommit}/promote`
      )
      .then((res) => {
        if (res.data.ok) {
          setCurrentCommit(null);
          setPages(res.data.pages);
          setCurrentPage(res.data.pages[0].path);
          setLastSavedPages(res.data.pages);
          setPreviewPage(res.data.pages[0].path);
          toast.success("Version promoted successfully");
        }
      })
      .catch((err) => {
        toast.error(err.response.data.error);
      });
    setIsPromotingVersion(false);
  };

  const handleMouseOver = (event: MouseEvent) => {
    if (iframeRef?.current) {
      const iframeDocument = iframeRef.current.contentDocument;
      if (iframeDocument) {
        const targetElement = event.target as HTMLElement;
        if (
          hoveredElement?.tagName !== targetElement.tagName ||
          hoveredElement?.rect.top !==
            targetElement.getBoundingClientRect().top ||
          hoveredElement?.rect.left !==
            targetElement.getBoundingClientRect().left ||
          hoveredElement?.rect.width !==
            targetElement.getBoundingClientRect().width ||
          hoveredElement?.rect.height !==
            targetElement.getBoundingClientRect().height
        ) {
          if (targetElement !== iframeDocument.body) {
            const rect = targetElement.getBoundingClientRect();
            setHoveredElement({
              tagName: targetElement.tagName,
              rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              },
            });
            targetElement.classList.add("hovered-element");
          } else {
            return setHoveredElement(null);
          }
        }
      }
    }
  };
  const handleMouseOut = () => {
    setHoveredElement(null);
  };
  const handleClick = (event: MouseEvent) => {
    if (iframeRef?.current) {
      const iframeDocument = iframeRef.current.contentDocument;
      if (iframeDocument) {
        const path = event.composedPath();
        const targetElement = path[0] as HTMLElement;

        const findClosestAnchor = (
          element: HTMLElement
        ): HTMLAnchorElement | null => {
          let current: HTMLElement | null = element;
          while (current) {
            if (current.tagName?.toUpperCase() === "A") {
              return current as HTMLAnchorElement;
            }
            if (current === iframeDocument.body) {
              break;
            }
            const parent: Node | null = current.parentNode;
            if (parent && parent.nodeType === 11) {
              current = (parent as ShadowRoot).host as HTMLElement;
            } else if (parent && parent.nodeType === 1) {
              current = parent as HTMLElement;
            } else {
              break;
            }
          }
          return null;
        };

        const anchorElement = findClosestAnchor(targetElement);

        if (anchorElement) {
          return;
        }

        if (targetElement !== iframeDocument.body) {
          setSelectedElement(targetElement);
        }
      }
    }
  };

  const handleCustomNavigation = (event: MouseEvent) => {
    if (iframeRef?.current) {
      const iframeDocument = iframeRef.current.contentDocument;
      if (iframeDocument) {
        const path = event.composedPath();
        const actualTarget = path[0] as HTMLElement;

        const findClosestAnchor = (
          element: HTMLElement
        ): HTMLAnchorElement | null => {
          let current: HTMLElement | null = element;
          while (current) {
            if (current.tagName?.toUpperCase() === "A") {
              return current as HTMLAnchorElement;
            }
            if (current === iframeDocument.body) {
              break;
            }
            const parent: Node | null = current.parentNode;
            if (parent && parent.nodeType === 11) {
              current = (parent as ShadowRoot).host as HTMLElement;
            } else if (parent && parent.nodeType === 1) {
              current = parent as HTMLElement;
            } else {
              break;
            }
          }
          return null;
        };

        const anchorElement = findClosestAnchor(actualTarget);
        if (anchorElement) {
          let href = anchorElement.getAttribute("href");
          if (href) {
            event.stopPropagation();
            event.preventDefault();

            if (href.startsWith("#")) {
              // Handle empty hash (scroll to top)
              if (href === "#") {
                iframeRef.current?.contentWindow?.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }

              let targetElement = iframeDocument.querySelector(href);

              if (!targetElement) {
                const searchInShadows = (
                  root: Document | ShadowRoot
                ): Element | null => {
                  const elements = root.querySelectorAll("*");
                  for (const el of elements) {
                    if (el.shadowRoot) {
                      const found = el.shadowRoot.querySelector(href);
                      if (found) return found;
                      const nested = searchInShadows(el.shadowRoot);
                      if (nested) return nested;
                    }
                  }
                  return null;
                };
                targetElement = searchInShadows(iframeDocument);
              }

              if (targetElement) {
                targetElement.scrollIntoView({ behavior: "smooth" });
              }
              return;
            }

            let normalizedHref = href.replace(/^\.?\//, "");

            if (normalizedHref === "" || normalizedHref === "/") {
              normalizedHref = "index.html";
            }

            const hashIndex = normalizedHref.indexOf("#");
            if (hashIndex !== -1) {
              normalizedHref = normalizedHref.substring(0, hashIndex);
            }

            if (!normalizedHref.includes(".")) {
              normalizedHref = normalizedHref + ".html";
            }

            const isPageExist = pagesToUse.some((page) => {
              const pagePath = page.path.replace(/^\.?\//, "");
              return pagePath === normalizedHref;
            });

            if (isPageExist) {
              setPreviewPage(normalizedHref);
            }
          }
        }
      }
    }
  };

  return (
    <div
      className={classNames(
        "bg-neutral-900/30 w-full h-[calc(100dvh-57px)] flex flex-col items-center justify-center relative z-1 lg:border-l border-neutral-800",
        {
          "max-lg:h-0 overflow-hidden": currentTab === "chat",
          "max-lg:h-full": currentTab === "preview",
        }
      )}
    >
      <GridPattern
        x={-1}
        y={-1}
        strokeDasharray={"4 2"}
        className={cn(
          "[mask-image:radial-gradient(900px_circle_at_center,white,transparent)] opacity-40"
        )}
      />
      {/* Preview page indicator */}
      {!isAiWorking && hoveredElement && isEditableModeEnabled && (
        <div
          className="cursor-pointer absolute bg-sky-500/10 border-[2px] border-dashed border-sky-500 rounded-r-lg rounded-b-lg p-3 z-10 pointer-events-none"
          style={{
            top: hoveredElement.rect.top + 40,
            left: hoveredElement.rect.left,
            width: hoveredElement.rect.width,
            height: hoveredElement.rect.height,
          }}
        >
          <span className="bg-sky-500 rounded-t-md text-sm text-neutral-100 px-2 py-0.5 -translate-y-7 absolute top-0 left-0">
            {htmlTagToText(hoveredElement.tagName.toLowerCase())}
          </span>
        </div>
      )}
      {isLoadingProject ? (
        <div className="w-full h-full flex items-center justify-center relative">
          <div className="py-10 w-full relative z-1 max-w-3xl mx-auto text-center">
            <AiLoading text="Fetching your project..." className="flex-col" />
            <AnimatedBlobs />
            <AnimatedBlobs />
          </div>
        </div>
      ) : (
        <>
          {isLoadingCommitPages && (
            <div className="top-0 left-0 right-0 z-20 bg-blue-500/90 backdrop-blur-sm border-b border-blue-600 px-4 py-2 flex items-center justify-center gap-3 text-sm w-full">
              <div className="flex items-center gap-2">
                <AiLoading
                  text="Loading commit version..."
                  className="flex-row"
                />
              </div>
            </div>
          )}
          {!isNew && !currentCommit && (
            <div className="top-0 left-0 right-0 z-20 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 px-4 py-2 max-h-[40px] flex items-center justify-between gap-3 text-xs w-full">
              <div className="flex items-center gap-2 flex-1">
                <TriangleAlert className="size-4 text-neutral-500 flex-shrink-0" />
                <span className="text-neutral-400 font-medium">
                  Preview version of the project. Try refreshing the preview if
                  you experience any issues.
                </span>
              </div>
              <button
                onClick={refreshPreview}
                className="cursor-pointer text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <RefreshCcw className="size-3 text-neutral-300 flex-shrink-0" />
                Refresh
              </button>
            </div>
          )}
          <iframe
            key={previewKey}
            id="preview-iframe"
            ref={iframeRef}
            className={classNames(
              "w-full select-none transition-all duration-200 bg-black h-full",
              {
                "lg:max-w-md lg:mx-auto lg:!rounded-[42px] lg:border-[8px] lg:border-neutral-700 lg:shadow-2xl lg:h-[80dvh] lg:max-h-[996px]":
                  device === "mobile",
              }
            )}
            src={
              currentCommit && project?.id && !project?.private
                ? `https://${project?.id?.replaceAll(
                    "/",
                    "-"
                  )}--rev-${currentCommit.slice(0, 7)}.static.hf.space`
                : undefined
            }
            srcDoc={srcDocValue}
            onLoad={() => {
              if (
                currentCommit ||
                isNew ||
                hasUnsavedChanges ||
                project?.private
              ) {
                if (iframeRef?.current?.contentWindow?.document?.body) {
                  iframeRef.current.contentWindow.document.body.scrollIntoView({
                    block: isAiWorking ? "end" : "start",
                    inline: "nearest",
                    behavior: isAiWorking ? "instant" : "smooth",
                  });
                }
                setupIframeListeners();
              }
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms"
            allow="accelerometer; ambient-light-sensor; autoplay; battery; camera; clipboard-read; clipboard-write; display-capture; document-domain; encrypted-media; fullscreen; geolocation; gyroscope; layout-animations; legacy-image-formats; magnetometer; microphone; midi; oversized-images; payment; picture-in-picture; publickey-credentials-get; serial; sync-xhr; usb; vr ; wake-lock; xr-spatial-tracking"
          />
          {!isNew && (
            <>
              <div
                className={classNames(
                  "w-full h-full flex items-center justify-center absolute left-0 top-0 bg-black/40 backdrop-blur-lg transition-all duration-200",
                  {
                    "opacity-0 pointer-events-none": !globalAiLoading,
                  }
                )}
              >
                <div className="py-10 w-full relative z-1 max-w-3xl mx-auto text-center">
                  <AiLoading
                    text={
                      isLoadingProject ? "Fetching your project..." : undefined
                    }
                    className="flex-col"
                  />
                  <AnimatedBlobs />
                  <AnimatedBlobs />
                </div>
              </div>
              <HistoryNotification
                isVisible={!!currentCommit}
                isPromotingVersion={isPromotingVersion}
                onPromoteVersion={promoteVersion}
                onGoBackToCurrent={() => setCurrentCommit(null)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
