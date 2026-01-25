import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

/**
 * Compress a string using LZ-String
 * Typically achieves 60-80% size reduction for HTML/CSS/JS
 */
export function compress(text: string): string {
  try {
    return compressToUTF16(text);
  } catch (error) {
    console.error('Compression failed:', error);
    // Fallback to original text if compression fails
    return text;
  }
}

/**
 * Decompress a string compressed with LZ-String
 */
export function decompress(compressed: string): string {
  try {
    const decompressed = decompressFromUTF16(compressed);
    // If decompression returns null, return the original string
    // (it might not have been compressed)
    return decompressed || compressed;
  } catch (error) {
    console.error('Decompression failed:', error);
    // Fallback to original string if decompression fails
    return compressed;
  }
}

/**
 * Check if a string appears to be compressed
 */
export function isCompressed(text: string): boolean {
  // LZ-String UTF16 compressed strings have specific characteristics
  // They typically contain UTF16 surrogate pairs
  return /[\uD800-\uDBFF]/.test(text);
}

/**
 * Get compression statistics
 */
export function getCompressionStats(original: string, compressed: string) {
  const originalSize = new Blob([original]).size;
  const compressedSize = new Blob([compressed]).size;
  const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
  
  return {
    originalSize,
    compressedSize,
    savedBytes: originalSize - compressedSize,
    compressionRatio: `${ratio}%`,
  };
}
