/**
 * Centralized Error Handler
 * Custom error classes and unified error handling
 */

import { log } from '../utils/logger.js';
import { captureException } from './sentry.js';

/**
 * Base error class for Midknight bot
 */
export class MidknightError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

/**
 * Plugin execution error
 */
export class PluginError extends MidknightError {
  constructor(pluginName, message, context = {}) {
    super(message, 'PLUGIN_ERROR', { ...context, pluginName });
    this.pluginName = pluginName;
  }
}

/**
 * Configuration validation error
 */
export class ValidationError extends MidknightError {
  constructor(message, field = null, context = {}) {
    super(message, 'VALIDATION_ERROR', { ...context, field });
    this.field = field;
  }
}

/**
 * Network/API error
 */
export class NetworkError extends MidknightError {
  constructor(message, url = null, context = {}) {
    super(message, 'NETWORK_ERROR', { ...context, url });
    this.url = url;
  }
}

/**
 * Session/Authentication error
 */
export class SessionError extends MidknightError {
  constructor(message, context = {}) {
    super(message, 'SESSION_ERROR', context);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends MidknightError {
  constructor(message, limit = null, context = {}) {
    super(message, 'RATE_LIMIT_ERROR', { ...context, limit });
    this.limit = limit;
  }
}

/**
 * Handle error and report to Sentry
 * @param {Error} error - Error to handle
 * @param {object} context - Additional context
 * @param {boolean} silent - Don't log to console
 */
export function handleError(error, context = {}, silent = false) {
  // Determine error severity
  const isOperationalError = error instanceof MidknightError;
  const level = isOperationalError ? 'warn' : 'error';

  // Log error
  if (!silent) {
    log[level](`Error: ${error.message}`, {
      error: error.name,
      code: error.code,
      context: error.context || context,
      stack: !isOperationalError ? error.stack : undefined
    });
  }

  // Report to Sentry (skip for operational errors unless critical)
  const shouldReport = !isOperationalError ||
    error instanceof SessionError ||
    error instanceof PluginError;

  if (shouldReport) {
    captureException(error, {
      level,
      tags: {
        errorType: error.name,
        errorCode: error.code || 'UNKNOWN',
        ...context.tags
      },
      extra: {
        context: error.context || context,
        ...context.extra
      }
    });
  }

  return {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      type: error.name
    }
  };
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Function to wrap
 * @param {object} context - Error context
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, context);
    }
  };
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers() {
  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception!', {
      error: error.message,
      stack: error.stack
    });

    captureException(error, {
      level: 'fatal',
      tags: { source: 'uncaughtException' }
    });

    // Give Sentry time to send the event
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Promise Rejection!', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined
    });

    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureException(error, {
      level: 'error',
      tags: { source: 'unhandledRejection' }
    });
  });

  // Process warnings
  process.on('warning', (warning) => {
    log.warn('Process Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });

  log.info('Global error handlers configured');
}

export default {
  MidknightError,
  PluginError,
  ValidationError,
  NetworkError,
  SessionError,
  RateLimitError,
  handleError,
  withErrorHandling,
  setupGlobalErrorHandlers
};
