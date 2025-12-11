/**
 * Request Logging Middleware
 * Logs all command executions with timing and context
 */

import { log } from '../utils/logger.js';
import { addBreadcrumb } from './sentry.js';
import crypto from 'crypto';

// Track request metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  commandCounts: new Map(),
  userCounts: new Map(),
  avgResponseTime: 0
};

/**
 * Generate correlation ID for request tracing
 * @returns {string} Correlation ID
 */
function generateCorrelationId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Hash user ID for privacy
 * @param {string} userId - User JID or phone
 * @returns {string} Hashed user ID
 */
function hashUserId(userId) {
  if (!userId) return 'unknown';
  return crypto
    .createHash('sha256')
    .update(userId)
    .digest('hex')
    .slice(0, 12);
}

/**
 * Log command execution start
 * @param {object} context - Request context
 * @returns {object} Request metadata (for completion logging)
 */
export function logRequestStart(context) {
  const {
    command,
    sender,
    chat,
    isGroup = false,
    args = []
  } = context;

  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  const hashedUser = hashUserId(sender);

  // Update metrics
  metrics.totalRequests++;
  metrics.commandCounts.set(
    command,
    (metrics.commandCounts.get(command) || 0) + 1
  );
  metrics.userCounts.set(
    hashedUser,
    (metrics.userCounts.get(hashedUser) || 0) + 1
  );

  // Log request
  log.info(`Command: ${command}`, {
    correlationId,
    command,
    user: hashedUser,
    chatType: isGroup ? 'group' : 'dm',
    argsCount: args.length,
    timestamp: new Date().toISOString()
  });

  // Add breadcrumb for Sentry
  addBreadcrumb({
    type: 'user',
    category: 'command',
    message: `User executed: ${command}`,
    level: 'info',
    data: {
      correlationId,
      command,
      chatType: isGroup ? 'group' : 'dm',
      argsCount: args.length
    }
  });

  return {
    correlationId,
    startTime,
    command,
    hashedUser
  };
}

/**
 * Log command execution completion
 * @param {object} metadata - Request metadata from logRequestStart
 * @param {boolean} success - Whether command succeeded
 * @param {Error} error - Error if command failed
 */
export function logRequestEnd(metadata, success = true, error = null) {
  const { correlationId, startTime, command, hashedUser } = metadata;
  const duration = Date.now() - startTime;

  // Update metrics
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }

  // Update average response time
  const totalCompleted = metrics.successfulRequests + metrics.failedRequests;
  metrics.avgResponseTime = (
    (metrics.avgResponseTime * (totalCompleted - 1) + duration) /
    totalCompleted
  );

  // Log completion
  const logLevel = success ? 'info' : 'error';
  log[logLevel](`Command ${success ? 'completed' : 'failed'}: ${command}`, {
    correlationId,
    command,
    user: hashedUser,
    duration: `${duration}ms`,
    success,
    error: error ? error.message : undefined,
    timestamp: new Date().toISOString()
  });

  // Add breadcrumb
  addBreadcrumb({
    type: 'default',
    category: 'command.complete',
    message: `Command ${command} ${success ? 'completed' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: {
      correlationId,
      command,
      duration,
      success
    }
  });

  // Warn on slow commands (>5 seconds)
  if (duration > 5000) {
    log.warn(`Slow command detected: ${command}`, {
      correlationId,
      command,
      duration: `${duration}ms`,
      threshold: '5000ms'
    });
  }
}

/**
 * Wrap plugin execution with logging
 * @param {Function} fn - Plugin run function
 * @param {string} pluginName - Plugin name
 * @returns {Function} Wrapped function
 */
export function withRequestLogging(fn, pluginName) {
  return async (context) => {
    const metadata = logRequestStart({
      command: context.command || pluginName,
      sender: context.sender,
      chat: context.chat,
      isGroup: context.isGroup,
      args: context.args
    });

    try {
      const result = await fn(context);
      logRequestEnd(metadata, true);
      return result;
    } catch (error) {
      logRequestEnd(metadata, false, error);
      throw error;
    }
  };
}

/**
 * Get current metrics
 * @returns {object} Request metrics
 */
export function getMetrics() {
  return {
    total: metrics.totalRequests,
    successful: metrics.successfulRequests,
    failed: metrics.failedRequests,
    successRate: metrics.totalRequests > 0
      ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%'
      : '0%',
    avgResponseTime: Math.round(metrics.avgResponseTime) + 'ms',
    topCommands: Array.from(metrics.commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ command: cmd, count })),
    uniqueUsers: metrics.userCounts.size
  };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics() {
  metrics.totalRequests = 0;
  metrics.successfulRequests = 0;
  metrics.failedRequests = 0;
  metrics.commandCounts.clear();
  metrics.userCounts.clear();
  metrics.avgResponseTime = 0;
}

/**
 * Log system event
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export function logSystemEvent(event, data = {}) {
  log.info(`System: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });

  addBreadcrumb({
    type: 'default',
    category: 'system',
    message: event,
    level: 'info',
    data
  });
}

export default {
  logRequestStart,
  logRequestEnd,
  withRequestLogging,
  getMetrics,
  resetMetrics,
  logSystemEvent,
  generateCorrelationId,
  hashUserId
};
