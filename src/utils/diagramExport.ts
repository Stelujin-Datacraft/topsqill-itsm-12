import html2canvas from 'html2canvas';

/**
 * Export a DOM element as a PNG file download.
 */
export async function exportAsPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Export a DOM element as an SVG file download (using foreignObject to embed HTML).
 */
export async function exportAsSvg(element: HTMLElement, filename: string): Promise<void> {
  const rect = element.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  // Clone the element and inline all computed styles
  const clone = element.cloneNode(true) as HTMLElement;
  await inlineStyles(element, clone);

  const serializer = new XMLSerializer();
  const htmlString = serializer.serializeToString(clone);

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:#ffffff;">
      ${htmlString}
    </div>
  </foreignObject>
</svg>`;

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Inline computed styles from the original element onto the clone
 * so the SVG foreignObject renders correctly.
 */
function inlineStyles(source: Element, target: Element): void {
  const sourceStyles = window.getComputedStyle(source);
  const targetEl = target as HTMLElement;

  // Copy key visual styles
  const importantProps = [
    'color', 'background-color', 'background', 'font-family', 'font-size',
    'font-weight', 'line-height', 'border', 'border-radius', 'padding',
    'margin', 'display', 'flex-direction', 'align-items', 'justify-content',
    'gap', 'width', 'height', 'min-width', 'min-height', 'max-width',
    'max-height', 'overflow', 'position', 'box-shadow', 'text-align',
    'white-space', 'word-break', 'flex-shrink', 'flex-grow',
  ];

  for (const prop of importantProps) {
    targetEl.style.setProperty(prop, sourceStyles.getPropertyValue(prop));
  }

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i++) {
    inlineStyles(sourceChildren[i], targetChildren[i]);
  }
}
