import { supabase } from './supabase';

// Template types
export type TemplateType = 'instagram-post' | 'facebook-post' | 'instagram-story';

export interface TemplateData {
  headline: string;
  subheadline?: string;
  category?: string;
  imageUrl?: string;
  brandName?: string;
  brandHandle?: string;
}

// Template sizes
const TEMPLATE_SIZES: Record<TemplateType, { width: number; height: number }> = {
  'instagram-post': { width: 1080, height: 1350 },
  'facebook-post': { width: 1200, height: 628 },
  'instagram-story': { width: 1080, height: 1920 },
};

// Gradient options
const GRADIENTS = [
  'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)', // sunset
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // ocean
  'linear-gradient(135deg, #11998e 0%, #8ce830 100%)', // forest
  'linear-gradient(135deg, #232526 0%, #414345 100%)', // night
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', // tech
];

/**
 * Generate HTML for a template with injected data
 */
export function generateTemplateHtml(
  template: TemplateType,
  data: TemplateData
): string {
  const size = TEMPLATE_SIZES[template];
  const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

  // Escape HTML to prevent XSS
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
  <meta name="viewport" content="width=${size.width}, height=${size.height}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${size.width}px; 
      height: ${size.height}px; 
      font-family: 'Inter', sans-serif;
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
      font-size: 14px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 2px;
      padding: 12px 24px; border-radius: 8px;
      margin-bottom: 24px; width: fit-content;
    }
    .headline {
      font-size: 64px; font-weight: 800;
      color: #ffffff; line-height: 1.1;
      margin-bottom: 24px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .subheadline {
      font-size: 28px; font-weight: 400;
      color: rgba(255,255,255,0.85); line-height: 1.4;
      margin-bottom: 100px;
    }
    .branding {
      display: flex; align-items: center; gap: 16px;
    }
    .logo {
      width: 48px; height: 48px;
      background: #8ce830; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 800; color: #141811;
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
        <span class="brand-text">${escape(data.brandHandle || '@yourbrand')}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Facebook default
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${size.width}, height=${size.height}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: ${size.width}px; 
      height: ${size.height}px; 
      font-family: 'Inter', sans-serif;
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
      width: 50%; height: 100%; padding: 48px;
      display: flex; flex-direction: column;
      justify-content: center; background: #ffffff;
    }
    .category {
      display: inline-block;
      background: #8ce830; color: #141811;
      font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.5px;
      padding: 8px 16px; border-radius: 6px;
      margin-bottom: 20px; width: fit-content;
    }
    .headline {
      font-size: 36px; font-weight: 800;
      color: #141811; line-height: 1.15;
      margin-bottom: 16px;
    }
    .subheadline {
      font-size: 18px; font-weight: 400;
      color: #758863; line-height: 1.5;
      margin-bottom: 32px;
    }
    .branding {
      display: flex; align-items: center; gap: 12px;
      margin-top: auto;
    }
    .logo {
      width: 36px; height: 36px;
      background: #8ce830; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 800; color: #141811;
    }
    .brand-text {
      font-size: 14px; font-weight: 600; color: #758863;
    }
    .accent {
      position: absolute; bottom: 0; left: 50%;
      width: 4px; height: 100px;
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
        <span class="brand-text">${escape(data.brandName || 'yourbrand.com')}</span>
      </div>
    </div>
    <div class="accent"></div>
  </div>
</body>
</html>`;
}

/**
 * Get template size
 */
export function getTemplateSize(template: TemplateType) {
  return TEMPLATE_SIZES[template];
}

/**
 * Upload generated image to Supabase Storage
 */
export async function uploadImage(
  base64Data: string,
  contentId: string,
  platform: 'instagram' | 'facebook'
): Promise<{ path: string; publicUrl: string } | null> {
  // Remove data URL prefix if present
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  // Decode base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fileName = `${contentId}/${platform}-${Date.now()}.png`;

  const { data, error } = await supabase.storage
    .from('generated-images')
    .upload(fileName, bytes.buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('generated-images')
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}
