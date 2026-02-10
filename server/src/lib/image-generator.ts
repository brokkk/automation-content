/**
 * Server-side Image Generator
 * Uses Playwright to render HTML templates to images
 */
import { chromium, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Template types
export type TemplateType = 'instagram-post' | 'facebook-post';

export interface TemplateData {
  headline: string;
  subheadline?: string;
  category?: string;
  imageUrl?: string;
  brandHandle?: string;
}

// Template sizes
const TEMPLATE_SIZES: Record<TemplateType, { width: number; height: number }> = {
  'instagram-post': { width: 1080, height: 1350 },
  'facebook-post': { width: 1200, height: 628 },
};

// Gradients for background variety
const GRADIENTS = [
  'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)', // sunset
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // ocean
  'linear-gradient(135deg, #11998e 0%, #8ce830 100%)', // forest
  'linear-gradient(135deg, #232526 0%, #414345 100%)', // night
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', // tech
  'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)', // pink-purple
  'linear-gradient(135deg, #F97316 0%, #EAB308 100%)', // orange-yellow
];

// Browser instance (reused)
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

/**
 * Generate HTML template
 */
function generateTemplateHtml(
  template: TemplateType,
  data: TemplateData
): string {
  const size = TEMPLATE_SIZES[template];
  const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

  const escape = (str: string = '') =>
    str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  if (template === 'instagram-post') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${size.width}px; 
      height: ${size.height}px; 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
    }
    .card {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      position: relative;
      ${data.imageUrl ? '' : `background: ${gradient};`}
    }
    .bg-image {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .overlay {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(to bottom, 
        rgba(0,0,0,0) 0%, 
        rgba(0,0,0,0.3) 50%, 
        rgba(0,0,0,0.85) 100%
      );
    }
    .content {
      position: relative; z-index: 10;
      padding: 60px; flex: 1;
      display: flex; flex-direction: column;
      justify-content: flex-end;
    }
    .category {
      display: inline-block;
      background: #8ce830; color: #141811;
      font-size: 16px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 2px;
      padding: 12px 24px; border-radius: 8px;
      margin-bottom: 24px; width: fit-content;
    }
    .headline {
      font-size: 48px; font-weight: 800;
      color: #ffffff; line-height: 1.15;
      margin-bottom: 24px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .subheadline {
      font-size: 26px; font-weight: 400;
      color: rgba(255,255,255,0.85); line-height: 1.4;
      margin-bottom: 40px;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .branding {
      display: flex; align-items: center; gap: 16px;
    }
    .logo {
      width: 48px; height: 48px;
      background: #8ce830; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 800; color: #141811;
    }
    .brand-text {
      font-size: 20px; font-weight: 600;
      color: rgba(255,255,255,0.7);
    }
    .accent-line {
      position: absolute; top: 60px; left: 60px;
      width: 80px; height: 6px;
      background: #8ce830; border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="card">
    ${data.imageUrl ? `<img class="bg-image" src="${escape(data.imageUrl)}" alt="">` : ''}
    <div class="overlay"></div>
    <div class="accent-line"></div>
    <div class="content">
      ${data.category ? `<div class="category">${escape(data.category)}</div>` : ''}
      <h1 class="headline">${escape(data.headline)}</h1>
      ${data.subheadline ? `<p class="subheadline">${escape(data.subheadline)}</p>` : ''}
      <div class="branding">
        <span class="brand-text">${escape(data.brandHandle || '@lifestylemedia')}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Facebook template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${size.width}px; 
      height: ${size.height}px; 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
    }
    .card {
      width: 100%; height: 100%;
      display: flex; position: relative;
      background: #1a1f14;
    }
    .image-side {
      width: 50%; height: 100%; position: relative;
      ${data.imageUrl ? '' : `background: ${gradient};`}
    }
    .bg-image {
      width: 100%; height: 100%; object-fit: cover;
    }
    .content-side {
      width: 50%; height: 100%; padding: 40px;
      display: flex; flex-direction: column;
      justify-content: center; background: #ffffff;
    }
    .category {
      display: inline-block;
      background: #8ce830; color: #141811;
      font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.5px;
      padding: 8px 16px; border-radius: 6px;
      margin-bottom: 16px; width: fit-content;
    }
    .headline {
      font-size: 32px; font-weight: 800;
      color: #141811; line-height: 1.2;
      margin-bottom: 12px;
    }
    .subheadline {
      font-size: 16px; font-weight: 400;
      color: #758863; line-height: 1.5;
      margin-bottom: 24px;
    }
    .branding {
      display: flex; align-items: center; gap: 12px;
      margin-top: auto;
    }
    .logo {
      width: 32px; height: 32px;
      background: #8ce830; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800; color: #141811;
    }
    .brand-text {
      font-size: 14px; font-weight: 600; color: #758863;
    }
    .accent {
      position: absolute; bottom: 0; left: 50%;
      width: 4px; height: 80px;
      background: #8ce830;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="image-side">
      ${data.imageUrl ? `<img class="bg-image" src="${escape(data.imageUrl)}" alt="">` : ''}
    </div>
    <div class="content-side">
      ${data.category ? `<div class="category">${escape(data.category)}</div>` : ''}
      <h1 class="headline">${escape(data.headline)}</h1>
      ${data.subheadline ? `<p class="subheadline">${escape(data.subheadline)}</p>` : ''}
      <div class="branding">
        <span class="brand-text">${escape(data.brandHandle || 'lifestylemedia.com')}</span>
      </div>
    </div>
    <div class="accent"></div>
  </div>
</body>
</html>`;
}

/**
 * Generate image from template data
 * Returns base64 PNG data
 */
export async function generateImage(
  template: TemplateType,
  data: TemplateData
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const size = TEMPLATE_SIZES[template];
    const html = generateTemplateHtml(template, data);

    await page.setViewportSize(size);
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Wait for fonts and images to load
    await page.waitForTimeout(1000);

    // If there's an external image, wait for it to load
    if (data.imageUrl) {
      try {
        await page.waitForFunction(() => {
          const img = document.querySelector('.bg-image') as HTMLImageElement;
          return img && img.complete && img.naturalHeight !== 0;
        }, { timeout: 5000 });
      } catch {
        console.log('  ⚠️ Image load timeout, proceeding with gradient fallback');
      }
    }

    // Extra wait for rendering
    await page.waitForTimeout(500);

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });

    return screenshot;
  } finally {
    await page.close();
  }
}

/**
 * Generate and save image to disk
 */
export async function generateAndSaveImage(
  template: TemplateType,
  data: TemplateData,
  outputPath: string
): Promise<string> {
  const buffer = await generateImage(template, data);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Close browser when done
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
