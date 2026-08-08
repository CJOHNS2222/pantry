/**
 * Generates a blur data URL for progressive image loading
 * Creates a simple colored rectangle as a placeholder
 * @param width Image width
 * @param height Image height
 * @param color Background color (hex format, defaults to theme color)
 * @returns Data URL for blurred placeholder
 */
export function generateBlurDataURL(width: number = 400, height: number = 300, color: string = '#f3f4f6'): string {
  // Create a simple SVG with the specified color
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `;

  // Convert SVG to base64 data URL
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}
