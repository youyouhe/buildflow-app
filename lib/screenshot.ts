import html2canvas from 'html2canvas';

/**
 * Capture screenshot from iframe element
 * @param iframeElement - The iframe DOM element to capture
 * @returns Base64 encoded JPEG image, or null on failure
 */
export async function captureScreenshot(
  iframeElement: HTMLIFrameElement | null
): Promise<string | null> {
  if (!iframeElement) {
    console.warn('[Screenshot] No iframe element provided');
    return null;
  }

  try {
    const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
    
    if (!iframeDoc || !iframeDoc.body) {
      console.warn('[Screenshot] Iframe document not accessible');
      return getDefaultThumbnail();
    }

    // Wait a bit to ensure DOM is fully rendered
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture iframe content with html2canvas
    const canvas = await html2canvas(iframeDoc.body, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#000000',
      scale: 1, // Use device native scale
      logging: false,
      width: iframeDoc.body.scrollWidth,
      height: iframeDoc.body.scrollHeight,
    } as any);

    // Create target canvas (1200x675)
    const targetWidth = 1200;
    const targetHeight = 675;
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) {
      console.error('[Screenshot] Failed to get canvas context');
      return getDefaultThumbnail();
    }

    // Calculate scaling to fit target size (cover mode with center crop)
    const sourceRatio = canvas.width / canvas.height;
    const targetRatio = targetWidth / targetHeight;

    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (sourceRatio > targetRatio) {
      // Source is wider, fit height
      drawWidth = targetHeight * sourceRatio;
      offsetX = -(drawWidth - targetWidth) / 2;
    } else {
      // Source is taller, fit width
      drawHeight = targetWidth / sourceRatio;
      offsetY = -(drawHeight - targetHeight) / 2;
    }

    // Draw and crop
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);

    // Convert to JPEG Base64
    const base64 = targetCanvas.toDataURL('image/jpeg', 0.8);

    // Validate screenshot is not blank
    if (isBlankImage(base64)) {
      console.warn('[Screenshot] Generated blank screenshot, using default');
      return getDefaultThumbnail();
    }

    const sizeKB = (base64.length * 0.75 / 1024).toFixed(1); // Estimate KB size
    console.log(`✅ Screenshot captured: ${targetWidth}x${targetHeight}, ~${sizeKB}KB`);

    return base64;
  } catch (error) {
    console.error('[Screenshot] Capture failed:', error);
    return getDefaultThumbnail();
  }
}

/**
 * Check if image is blank (solid color background)
 */
function isBlankImage(base64: string): boolean {
  try {
    // Simple check: if base64 length is abnormally small, likely blank
    const minExpectedSize = 10000; // ~7.5KB
    return base64.length < minExpectedSize;
  } catch {
    return false;
  }
}

/**
 * Get default thumbnail placeholder
 * Returns a gradient background with BuildFlow branding
 */
export function getDefaultThumbnail(): string {
  // Create SVG with gradient background + grid pattern
  const svg = `
<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark gradient background -->
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#171717;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#262626;stop-opacity:1" />
    </linearGradient>
    
    <!-- Grid pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#404040" stroke-width="0.5" stroke-dasharray="4 2" opacity="0.4"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="675" fill="url(#bg-gradient)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  
  <!-- BuildFlow Logo/Text -->
  <text x="600" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#737373" text-anchor="middle">
    BuildFlow
  </text>
  <text x="600" y="380" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#525252" text-anchor="middle">
    AI Website Builder
  </text>
</svg>
  `.trim();

  // Convert SVG to Base64 Data URL
  const base64svg = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64svg}`;
}
