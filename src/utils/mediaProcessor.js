/**
 * Optimized Media Processing Utilities
 * Unified media processing with caching and optimization
 */

import sharp from 'sharp';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { log } from './logger.js';

// LRU cache for processed media
const mediaCache = new LRUCache({
  max: 100, // Max 100 items
  maxSize: 100 * 1024 * 1024, // 100MB total
  sizeCalculation: (value) => value.length,
  ttl: 3600000, // 1 hour TTL
  updateAgeOnGet: true,
  updateAgeOnHas: true
});

// File size limits (in bytes)
const SIZE_LIMITS = {
  image: 100 * 1024 * 1024, // 100MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 50 * 1024 * 1024,  // 50MB
  document: 100 * 1024 * 1024 // 100MB
};

/**
 * Generate cache key from buffer
 * @param {Buffer} buffer - Input buffer
 * @param {object} options - Processing options
 * @returns {string} Cache key
 */
function getCacheKey(buffer, options = {}) {
  const hash = createHash('sha256')
    .update(buffer)
    .update(JSON.stringify(options))
    .digest('hex');
  return hash.slice(0, 16);
}

/**
 * Check file size against limits
 * @param {Buffer|number} input - Buffer or size in bytes
 * @param {string} type - Media type (image, video, audio, document)
 * @returns {boolean} True if within limits
 */
export function checkFileSize(input, type = 'image') {
  const size = Buffer.isBuffer(input) ? input.length : input;
  const limit = SIZE_LIMITS[type] || SIZE_LIMITS.image;

  if (size > limit) {
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    const limitMB = (limit / 1024 / 1024).toFixed(2);
    log.warn(`File size ${sizeMB}MB exceeds limit ${limitMB}MB for ${type}`);
    return false;
  }

  return true;
}

/**
 * Optimize image using sharp
 * @param {Buffer} buffer - Input image buffer
 * @param {object} options - Processing options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export async function optimizeImage(buffer, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 85,
    format = 'jpeg',
    fit = 'inside',
    cache = true
  } = options;

  // Check cache first
  if (cache) {
    const cacheKey = getCacheKey(buffer, options);
    const cached = mediaCache.get(cacheKey);
    if (cached) {
      log.debug('Image cache hit');
      return cached;
    }
  }

  // Check file size
  if (!checkFileSize(buffer, 'image')) {
    throw new Error('Image file too large');
  }

  try {
    const startTime = Date.now();

    // Process image
    let pipeline = sharp(buffer, {
      failOnError: false,
      limitInputPixels: 268402689 // Prevent DoS (16384 x 16384)
    });

    // Resize if needed
    if (maxWidth || maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit,
        withoutEnlargement: true
      });
    }

    // Convert format
    const formatOptions = {
      jpeg: { quality, progressive: true, mozjpeg: true },
      png: { compressionLevel: 9, progressive: true },
      webp: { quality, effort: 6 }
    };

    if (format === 'jpeg') {
      pipeline = pipeline.jpeg(formatOptions.jpeg);
    } else if (format === 'png') {
      pipeline = pipeline.png(formatOptions.png);
    } else if (format === 'webp') {
      pipeline = pipeline.webp(formatOptions.webp);
    }

    // Execute
    const processed = await pipeline.toBuffer();

    const duration = Date.now() - startTime;
    const reduction = ((1 - (processed.length / buffer.length)) * 100).toFixed(2);

    log.info('Image optimized', {
      duration: `${duration}ms`,
      originalSize: `${(buffer.length / 1024).toFixed(2)}KB`,
      processedSize: `${(processed.length / 1024).toFixed(2)}KB`,
      reduction: `${reduction}%`
    });

    // Cache result
    if (cache) {
      const cacheKey = getCacheKey(buffer, options);
      mediaCache.set(cacheKey, processed);
    }

    return processed;

  } catch (error) {
    log.error('Image optimization failed', { error: error.message });
    throw error;
  }
}

/**
 * Create image thumbnail
 * @param {Buffer} buffer - Input image buffer
 * @param {number} size - Thumbnail size (default: 200)
 * @returns {Promise<Buffer>} Thumbnail buffer
 */
export async function createThumbnail(buffer, size = 200) {
  return optimizeImage(buffer, {
    maxWidth: size,
    maxHeight: size,
    quality: 75,
    fit: 'cover',
    cache: true
  });
}

/**
 * Convert image to sticker format
 * @param {Buffer} buffer - Input image buffer
 * @returns {Promise<Buffer>} Sticker-ready WebP image
 */
export async function imageToSticker(buffer) {
  return sharp(buffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 100 })
    .toBuffer();
}

/**
 * Get image metadata
 * @param {Buffer} buffer - Input image buffer
 * @returns {Promise<object>} Image metadata
 */
export async function getImageMetadata(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation
    };
  } catch (error) {
    log.error('Failed to get image metadata', { error: error.message });
    return null;
  }
}

/**
 * Validate image buffer
 * @param {Buffer} buffer - Input buffer
 * @returns {boolean} True if valid image
 */
export async function isValidImage(buffer) {
  try {
    await sharp(buffer).metadata();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
  return {
    size: mediaCache.size,
    maxSize: mediaCache.max,
    calculatedSize: mediaCache.calculatedSize,
    maxCalculatedSize: mediaCache.maxSize,
    utilization: ((mediaCache.calculatedSize / mediaCache.maxSize) * 100).toFixed(2) + '%'
  };
}

/**
 * Clear media cache
 */
export function clearCache() {
  const oldSize = mediaCache.size;
  mediaCache.clear();
  log.info(`Cleared media cache (${oldSize} items)`);
}

/**
 * Prune old cache entries
 */
export function pruneCache() {
  const oldSize = mediaCache.size;
  mediaCache.purgeStale();
  const removed = oldSize - mediaCache.size;
  if (removed > 0) {
    log.info(`Pruned ${removed} stale cache entries`);
  }
}

// Auto-prune cache every 10 minutes
setInterval(pruneCache, 600000);

export default {
  optimizeImage,
  createThumbnail,
  imageToSticker,
  getImageMetadata,
  isValidImage,
  checkFileSize,
  getCacheStats,
  clearCache,
  pruneCache
};
