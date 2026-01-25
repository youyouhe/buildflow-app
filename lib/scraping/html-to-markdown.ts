import TurndownService from "turndown";

/**
 * Create and configure a Turndown service for HTML to Markdown conversion
 */
export function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx", // Use # headers
    hr: "---", // Horizontal rules
    bulletListMarker: "-", // Bullet points
    codeBlockStyle: "fenced", // ```code blocks
    fence: "```", // Code fence marker
    emDelimiter: "*", // *emphasis*
    strongDelimiter: "**", // **strong**
    linkStyle: "inlined", // [text](url)
    linkReferenceStyle: "full", // Full references
  });

  // Remove unnecessary elements
  turndownService.remove([
    "script",
    "style",
    "noscript",
    "iframe",
    "canvas",
  ] as any);

  // Keep semantic HTML elements
  turndownService.keep(["article", "section", "main", "aside", "nav"]);

  // Custom rule for images
  turndownService.addRule("images", {
    filter: "img",
    replacement: function (content, node) {
      const element = node as HTMLElement;
      const alt = element.getAttribute("alt") || "";
      const src = element.getAttribute("src") || "";
      const title = element.getAttribute("title");

      if (!src) return "";

      // Make absolute URLs if they're relative
      let absoluteSrc = src;
      if (src.startsWith("/") || !src.startsWith("http")) {
        // We'll handle this in the main conversion function
        absoluteSrc = src;
      }

      if (title) {
        return `![${alt}](${absoluteSrc} "${title}")`;
      }
      return `![${alt}](${absoluteSrc})`;
    },
  });

  // Custom rule for links
  turndownService.addRule("links", {
    filter: "a",
    replacement: function (content, node) {
      const element = node as HTMLElement;
      const href = element.getAttribute("href");
      const title = element.getAttribute("title");

      if (!href || !content) return content;

      if (title) {
        return `[${content}](${href} "${title}")`;
      }
      return `[${content}](${href})`;
    },
  });

  return turndownService;
}

/**
 * Convert HTML to clean Markdown
 */
export function htmlToMarkdown(html: string, baseUrl?: string): string {
  const turndownService = createTurndownService();

  // Convert HTML to Markdown
  let markdown = turndownService.turndown(html);

  // Clean up the markdown
  markdown = cleanMarkdown(markdown);

  // Make relative URLs absolute if baseUrl provided
  if (baseUrl) {
    markdown = makeUrlsAbsolute(markdown, baseUrl);
  }

  return markdown;
}

/**
 * Clean up converted markdown
 */
export function cleanMarkdown(markdown: string): string {
  // Remove excessive blank lines (more than 2)
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Remove leading/trailing whitespace
  markdown = markdown.trim();

  // Remove excessive spaces
  markdown = markdown.replace(/ {2,}/g, " ");

  // Clean up list formatting
  markdown = markdown.replace(/\n- \n/g, "\n");

  // Remove empty links
  markdown = markdown.replace(/\[]\(\)/g, "");

  // Remove empty images
  markdown = markdown.replace(/!\[]\(\)/g, "");

  return markdown;
}

/**
 * Make relative URLs absolute
 */
function makeUrlsAbsolute(markdown: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);

    // Replace relative image URLs
    markdown = markdown.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, url) => {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return match;
        }
        try {
          const absoluteUrl = new URL(url, base.origin).href;
          return `![${alt}](${absoluteUrl})`;
        } catch {
          return match;
        }
      }
    );

    // Replace relative link URLs
    markdown = markdown.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, text, url) => {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          return match;
        }
        if (url.startsWith("#") || url.startsWith("mailto:")) {
          return match;
        }
        try {
          const absoluteUrl = new URL(url, base.origin).href;
          return `[${text}](${absoluteUrl})`;
        } catch {
          return match;
        }
      }
    );
  } catch (error) {
    console.error("Error making URLs absolute:", error);
  }

  return markdown;
}

/**
 * Validate URL format and security
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // Block localhost and internal IPs
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return false;
    }

    // Block internal IPs (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    if (hostname.match(/^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return false;
    }

    // Block 0.0.0.0 and 255.255.255.255
    if (hostname === "0.0.0.0" || hostname === "255.255.255.255") {
      return false;
    }

    // Block IPv6 localhost
    if (hostname === "::1" || hostname === "[::1]") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL for logging
 */
export function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "invalid-url";
  }
}

/**
 * Truncate markdown to a maximum length
 */
export function truncateMarkdown(markdown: string, maxLength: number): string {
  if (markdown.length <= maxLength) {
    return markdown;
  }

  const truncated = markdown.substring(0, maxLength);
  const lastParagraph = truncated.lastIndexOf("\n\n");

  if (lastParagraph > maxLength * 0.8) {
    return truncated.substring(0, lastParagraph) + "\n\n[Content truncated...]";
  }

  return truncated + "\n\n[Content truncated...]";
}
