/**
 * Sentry Error Tracking Integration
 * Captures and reports errors to Sentry with PII scrubbing
 */

import * as Sentry from '@sentry/node';
import { log } from '../utils/logger.js';

// PII patterns to scrub from error messages
const PII_PATTERNS = [
  // Phone numbers (international format)
  /\+?\d{10,15}/g,
  // WhatsApp JIDs
  /\d{10,15}@s\.whatsapp\.net/g,
  /\d{10,15}@g\.us/g,
  // API keys and tokens
  /([a-zA-Z0-9_-]{20,})/g,
  // Email addresses
  /[\w.-]+@[\w.-]+\.\w+/g,
  // Session IDs
  /Midknight~[\w-]+/g
];

/**
 * Scrub PII from text
 * @param {string} text - Text to scrub
 * @returns {string} Scrubbed text
 */
function scrubPII(text) {
  if (!text || typeof text !== 'string') return text;

  let scrubbed = text;

  PII_PATTERNS.forEach(pattern => {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  });

  return scrubbed;
}

/**
 * Initialize Sentry error tracking
 * @returns {boolean} True if Sentry was initialized
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    log.debug('Sentry DSN not configured, error tracking disabled');
    return false;
  }

  try {
    Sentry.init({
      dsn,

      // Environment
      environment: process.env.NODE_ENV || 'production',

      // Release tracking (use package version)
      release: `midknight@${process.env.npm_package_version || '1.0.0'}`,

      // Sample rate (100% for now, adjust in production if needed)
      tracesSampleRate: 0,

      // Performance monitoring disabled (focus on errors only)
      enableTracing: false,

      // Integrations
      integrations: [
        // Automatically instrument Node.js libraries
        new Sentry.Integrations.Http({ tracing: false }),
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection()
      ],

      // Before sending event - scrub PII
      beforeSend(event, hint) {
        // Scrub PII from exception messages
        if (event.exception?.values) {
          event.exception.values.forEach(exception => {
            if (exception.value) {
              exception.value = scrubPII(exception.value);
            }
            if (exception.stacktrace?.frames) {
              exception.stacktrace.frames.forEach(frame => {
                if (frame.context_line) {
                  frame.context_line = scrubPII(frame.context_line);
                }
              });
            }
          });
        }

        // Scrub PII from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs.forEach(breadcrumb => {
            if (breadcrumb.message) {
              breadcrumb.message = scrubPII(breadcrumb.message);
            }
            if (breadcrumb.data) {
              Object.keys(breadcrumb.data).forEach(key => {
                if (typeof breadcrumb.data[key] === 'string') {
                  breadcrumb.data[key] = scrubPII(breadcrumb.data[key]);
                }
              });
            }
          });
        }

        // Scrub PII from extra context
        if (event.extra) {
          Object.keys(event.extra).forEach(key => {
            if (typeof event.extra[key] === 'string') {
              event.extra[key] = scrubPII(event.extra[key]);
            }
          });
        }

        // Remove sensitive tags
        if (event.tags) {
          delete event.tags.phone;
          delete event.tags.jid;
          delete event.tags.sessionId;
        }

        return event;
      },

      // Ignore specific errors
      ignoreErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'network timeout',
        'Connection Closed',
        'WebSocket',
        // Baileys connection errors (common and not actionable)
        'Connection Failure',
        'Stream Errored',
        'Connection TimedOut'
      ]
    });

    log.info('Sentry error tracking initialized');
    return true;
  } catch (error) {
    log.error('Failed to initialize Sentry', { error: error.message });
    return false;
  }
}

/**
 * Capture an exception with Sentry
 * @param {Error} error - Error to capture
 * @param {object} context - Additional context
 */
export function captureException(error, context = {}) {
  if (!Sentry.getCurrentHub().getClient()) {
    // Sentry not initialized, just log
    log.error('Exception (Sentry disabled)', { error: error.message, context });
    return;
  }

  Sentry.withScope(scope => {
    // Add context
    if (context.user) {
      scope.setUser({
        id: scrubPII(context.user)
      });
    }

    if (context.tags) {
      Object.keys(context.tags).forEach(key => {
        scope.setTag(key, context.tags[key]);
      });
    }

    if (context.extra) {
      Object.keys(context.extra).forEach(key => {
        scope.setExtra(key, context.extra[key]);
      });
    }

    // Set level
    scope.setLevel(context.level || 'error');

    // Capture
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with Sentry
 * @param {string} message - Message to capture
 * @param {string} level - Severity level
 * @param {object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!Sentry.getCurrentHub().getClient()) {
    return;
  }

  const scrubbedMessage = scrubPII(message);

  Sentry.withScope(scope => {
    if (context.tags) {
      Object.keys(context.tags).forEach(key => {
        scope.setTag(key, context.tags[key]);
      });
    }

    if (context.extra) {
      Object.keys(context.extra).forEach(key => {
        scope.setExtra(key, context.extra[key]);
      });
    }

    scope.setLevel(level);
    Sentry.captureMessage(scrubbedMessage);
  });
}

/**
 * Add a breadcrumb (tracking user actions)
 * @param {object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
  if (!Sentry.getCurrentHub().getClient()) {
    return;
  }

  const scrubbed = {
    ...breadcrumb,
    message: breadcrumb.message ? scrubPII(breadcrumb.message) : undefined,
    data: breadcrumb.data ?
      Object.fromEntries(
        Object.entries(breadcrumb.data).map(([key, value]) => [
          key,
          typeof value === 'string' ? scrubPII(value) : value
        ])
      ) : undefined
  };

  Sentry.addBreadcrumb(scrubbed);
}

/**
 * Flush pending events (useful before shutdown)
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function flush(timeout = 2000) {
  if (!Sentry.getCurrentHub().getClient()) {
    return true;
  }

  try {
    await Sentry.close(timeout);
    return true;
  } catch (error) {
    log.error('Failed to flush Sentry events', { error: error.message });
    return false;
  }
}

export default {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  flush,
  scrubPII
};
