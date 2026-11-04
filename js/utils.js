/**
 * Fylink - Utility Functions
 * Helper functions for formatting, hashing, device naming, and validation.
 */

// List of friendly adjectives and nouns for auto-generating device names
const ADJECTIVES = [
  'Swift', 'Cosmic', 'Silent', 'Golden', 'Brave', 'Clever', 'Agile', 'Bright',
  'Calm', 'Eager', 'Gentle', 'Lucky', 'Nimble', 'Quick', 'Vibrant', 'Zen',
  'Solar', 'Lunar', 'Mystic', 'Rapid', 'Shadow', 'Radiant', 'Stellar', 'Wild'
];

const NOUNS = [
  'Falcon', 'Fox', 'Otter', 'Dolphin', 'Eagle', 'Hawk', 'Wolf', 'Panther',
  'Lynx', 'Panda', 'Tiger', 'Sparrow', 'Raven', 'Badger', 'Koala', 'Cheetah',
  'Orion', 'Comet', 'Atlas', 'Phoenix', 'Horizon', 'Voyager', 'Aurora', 'Beacon'
];

/**
 * Generate a random friendly device name
 */
export function generateDeviceName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * Generate a random 6-digit purely numeric code (e.g. 582914) for effortless typing
 */
export function generateSessionCode(length = 6) {
  let result = '';
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += (randomValues[i] % 10).toString();
  }
  return result;
}

/**
 * Format bytes to human readable format (KB, MB, GB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format transfer speed (Bytes/s -> KB/s or MB/s)
 */
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format time duration in seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0s';
  seconds = Math.round(seconds);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins.toString().padStart(2, '0')}m`;
}

/**
 * Extract clean hostname/domain from URL
 */
export function extractDomain(urlStr) {
  try {
    let url = urlStr.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return 'external link';
  }
}

/**
 * Sanitize filename to avoid directory traversal or forbidden characters
 */
export function sanitizeFilename(filename) {
  if (!filename) return 'unnamed-file';
  // Replace slashes and path traversal sequences
  return filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/**
 * Calculate SHA-256 hash of an ArrayBuffer
 */
export async function calculateSha256(arrayBuffer) {
  if (!window.crypto?.subtle) return null;
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Crypto subtle SHA-256 failed, skipping checksum:', err);
    return null;
  }
}

/**
 * Generate a thumbnail data URL from a Video file using canvas
 */
export function generateVideoThumbnail(file, seekTime = 1.0) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTime, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxW = 320;
        const scale = Math.min(1, maxW / (video.videoWidth || 320));
        canvas.width = (video.videoWidth || 320) * scale;
        canvas.height = (video.videoHeight || 240) * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const duration = video.duration || 0;
        cleanup();
        resolve({ thumbnail: dataUrl, duration });
      } catch (e) {
        cleanup();
        resolve({ thumbnail: null, duration: video.duration || 0 });
      }
    };

    video.onerror = () => {
      cleanup();
      resolve({ thumbnail: null, duration: 0 });
    };

    // Timeout fallback after 3 seconds
    setTimeout(() => {
      cleanup();
      resolve({ thumbnail: null, duration: 0 });
    }, 3000);
  });
}

/**
 * Generate an image thumbnail (max 320px)
 */
export function generateImageThumbnail(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve(null);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          thumbnail: canvas.toDataURL('image/jpeg', 0.8),
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Copy text to clipboard with modern fallback
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}
