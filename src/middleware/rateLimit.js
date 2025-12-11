/**
 * System-Wide Rate Limiting Middleware
 * Implements token bucket algorithm for fair rate limiting
 */

import { log } from '../utils/logger.js';
import { RateLimitError } from '../monitoring/errorHandler.js';

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  constructor(capacity, refillRate, refillInterval = 1000) {
    this.capacity = capacity; // Maximum tokens
    this.tokens = capacity; // Current tokens
    this.refillRate = refillRate; // Tokens added per interval
    this.refillInterval = refillInterval; // Refill interval in ms
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / this.refillInterval);

    if (intervalsElapsed > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + (intervalsElapsed * this.refillRate)
      );
      this.lastRefill = now;
    }
  }

  /**
   * Try to consume tokens
   * @param {number} count - Number of tokens to consume
   * @returns {boolean} True if tokens were consumed
   */
  consume(count = 1) {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Get time until next token is available
   * @returns {number} Milliseconds until next token
   */
  getRetryAfter() {
    this.refill();
    if (this.tokens >= 1) return 0;

    const tokensNeeded = 1 - this.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.refillRate);
    return intervalsNeeded * this.refillInterval;
  }

  /**
   * Get current state
   * @returns {object} Bucket state
   */
  getState() {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      capacity: this.capacity,
      fillPercent: ((this.tokens / this.capacity) * 100).toFixed(1) + '%'
    };
  }
}

/**
 * Rate limiter with multiple buckets per user
 */
class RateLimiter {
  constructor(config = {}) {
    this.config = {
      // Default limits
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 10,
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,

      // Owner exemption
      exemptOwners: true,

      // Cleanup interval
      cleanupInterval: 300000, // 5 minutes

      ...config
    };

    this.buckets = new Map(); // userId -> TokenBucket
    this.lastCleanup = Date.now();

    log.info('Rate limiter initialized', {
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs
    });
  }

  /**
   * Get or create bucket for user
   * @param {string} userId - User identifier
   * @returns {TokenBucket} User's token bucket
   */
  getBucket(userId) {
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, new TokenBucket(
        this.config.maxRequests,
        this.config.maxRequests / (this.config.windowMs / 1000) // Tokens per second
      ));
    }

    return this.buckets.get(userId);
  }

  /**
   * Check if request is allowed
   * @param {string} userId - User identifier
   * @param {boolean} isOwner - Whether user is owner
   * @returns {object} { allowed: boolean, retryAfter: number }
   */
  check(userId, isOwner = false) {
    // Owners are exempt
    if (isOwner && this.config.exemptOwners) {
      return { allowed: true, retryAfter: 0 };
    }

    const bucket = this.getBucket(userId);
    const allowed = bucket.consume(1);

    const result = {
      allowed,
      retryAfter: allowed ? 0 : bucket.getRetryAfter(),
      remaining: Math.floor(bucket.tokens),
      limit: this.config.maxRequests
    };

    // Log rate limit exceeded
    if (!allowed) {
      log.warn('Rate limit exceeded', {
        userId: userId.slice(0, 12) + '...',
        retryAfter: result.retryAfter + 'ms',
        limit: this.config.maxRequests
      });
    }

    // Periodic cleanup
    this.periodicCleanup();

    return result;
  }

  /**
   * Clean up stale buckets (not accessed in 1 hour)
   */
  cleanup() {
    const now = Date.now();
    const staleThreshold = 3600000; // 1 hour

    let removed = 0;
    for (const [userId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(userId);
        removed++;
      }
    }

    if (removed > 0) {
      log.debug(`Cleaned up ${removed} stale rate limit buckets`);
    }

    this.lastCleanup = now;
  }

  /**
   * Run cleanup periodically
   */
  periodicCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup > this.config.cleanupInterval) {
      this.cleanup();
    }
  }

  /**
   * Get statistics
   * @returns {object} Rate limiter stats
   */
  getStats() {
    return {
      activeBuckets: this.buckets.size,
      config: {
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
        exemptOwners: this.config.exemptOwners
      }
    };
  }

  /**
   * Reset bucket for user
   * @param {string} userId - User identifier
   */
  reset(userId) {
    this.buckets.delete(userId);
    log.info(`Rate limit reset for user ${userId.slice(0, 12)}...`);
  }

  /**
   * Reset all buckets
   */
  resetAll() {
    const count = this.buckets.size;
    this.buckets.clear();
    log.info(`Reset all rate limit buckets (${count} total)`);
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Middleware to check rate limit
 * @param {string} userId - User identifier
 * @param {boolean} isOwner - Whether user is owner
 * @returns {object} Rate limit result
 * @throws {RateLimitError} If rate limit exceeded
 */
export function checkRateLimit(userId, isOwner = false) {
  const result = rateLimiter.check(userId, isOwner);

  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfter / 1000)}s`,
      {
        retryAfter: result.retryAfter,
        limit: result.limit
      }
    );
  }

  return result;
}

/**
 * Get rate limit info for user (doesn't consume token)
 * @param {string} userId - User identifier
 * @returns {object} Rate limit info
 */
export function getRateLimitInfo(userId) {
  const bucket = rateLimiter.getBucket(userId);
  bucket.refill();

  return {
    remaining: Math.floor(bucket.tokens),
    limit: rateLimiter.config.maxRequests,
    resetIn: bucket.getRetryAfter()
  };
}

/**
 * Reset rate limit for user
 * @param {string} userId - User identifier
 */
export function resetRateLimit(userId) {
  rateLimiter.reset(userId);
}

/**
 * Get rate limiter statistics
 * @returns {object} Statistics
 */
export function getRateLimiterStats() {
  return rateLimiter.getStats();
}

export default {
  checkRateLimit,
  getRateLimitInfo,
  resetRateLimit,
  getRateLimiterStats,
  rateLimiter
};
