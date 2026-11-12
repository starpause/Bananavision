/**
 * Generates clean, cross-platform friendly image filenames based on the generation prompt.
 *
 * Rules:
 * - Compatible with Windows (avoids <>:"/\|?*), macOS, Linux, Android, and iOS.
 * - Extracts high-significance descriptive keywords while stripping stop words.
 * - Caps length under ~60 characters to leave ample room for path limits (MAX_PATH / 260 chars on Windows).
 * - Avoids extra LLM network roundtrips for speed and reliability, with a short hash/id suffix for uniqueness.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'from', 'as', 'is', 'are', 'was', 'were', 'it', 'its', 'this', 'that', 'these',
  'those', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'very',
  'high', 'quality', 'detailed', 'ultra', 'hyper', 'photo', 'photograph', 'image',
  'picture', 'render', 'rendering', 'style', 'background', 'wallpaper', '4k', '8k',
  'hdr', 'sharp', 'focus', 'clean', 'blank'
]);

export function formatDownloadFilename(prompt: string, id: string): string {
  if (!prompt || typeof prompt !== 'string') {
    return `art-${id.slice(0, 8)}.png`;
  }

  // 1. Normalize and strip non-alphanumeric except spaces and hyphens
  const cleaned = prompt
    .toLowerCase()
    .replace(/\[.*?\]/g, '') // remove bracket tags
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Tokenize words
  const words = cleaned.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // 3. Take up to 4 significant terms
  const meaningfulWords = words.length > 0 ? words.slice(0, 4) : ['generated', 'art'];

  // 4. Slugify with hyphens
  let slug = meaningfulWords.join('-');

  // 5. Ensure safe length (max ~45 chars for the slug)
  if (slug.length > 45) {
    slug = slug.slice(0, 45).replace(/-[^-]*$/, '');
  }

  // 6. Safe short id suffix (6 chars) to guarantee uniqueness without collision
  const shortId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'img';

  return `${slug}-${shortId}.png`;
}
