/**
 * In-Memory Metrics Collection
 * Collects and exposes system metrics
 */

import os from 'os';
import { log } from '../utils/logger.js';
import { getMetrics as getRequestMetrics } from './requestLogger.js';

// System metrics
const systemMetrics = {
  startTime: Date.now(),
  restarts: 0,
  crashes: 0,
  memoryLeaks: 0
};

/**
 * Get system uptime in seconds
 * @returns {number} Uptime in seconds
 */
export function getUptime() {
  return Math.floor((Date.now() - systemMetrics.startTime) / 1000);
}

/**
 * Format uptime as human-readable string
 * @returns {string} Formatted uptime
 */
export function formatUptime() {
  const seconds = getUptime();
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

/**
 * Get memory usage statistics
 * @returns {object} Memory stats
 */
export function getMemoryStats() {
  const usage = process.memoryUsage();

  return {
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB',
    external: (usage.external / 1024 / 1024).toFixed(2) + ' MB',
    heapUsagePercent: ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2) + '%'
  };
}

/**
 * Get CPU usage (approximate)
 * @returns {object} CPU stats
 */
export function getCPUStats() {
  const cpus = os.cpus();
  const usage = process.cpuUsage();

  return {
    cores: cpus.length,
    model: cpus[0].model,
    user: (usage.user / 1000000).toFixed(2) + 's',
    system: (usage.system / 1000000).toFixed(2) + 's',
    loadAverage: os.loadavg().map(l => l.toFixed(2))
  };
}

/**
 * Get system information
 * @returns {object} System info
 */
export function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    freeMemory: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    hostname: os.hostname(),
    uptime: formatUptime()
  };
}

/**
 * Get all metrics
 * @returns {object} Complete metrics
 */
export function getAllMetrics() {
  return {
    system: getSystemInfo(),
    memory: getMemoryStats(),
    cpu: getCPUStats(),
    requests: getRequestMetrics(),
    bot: {
      uptime: formatUptime(),
      restarts: systemMetrics.restarts,
      crashes: systemMetrics.crashes
    }
  };
}

/**
 * Check for memory leaks (simple heuristic)
 * @returns {boolean} True if potential leak detected
 */
export function checkMemoryLeak() {
  const usage = process.memoryUsage();
  const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;

  // Warn if heap usage is above 80%
  if (heapUsagePercent > 80) {
    log.warn('High memory usage detected', {
      heapUsagePercent: heapUsagePercent.toFixed(2) + '%',
      heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB'
    });

    systemMetrics.memoryLeaks++;
    return true;
  }

  return false;
}

/**
 * Start periodic memory monitoring
 * @param {number} interval - Check interval in ms (default: 5 minutes)
 */
export function startMemoryMonitoring(interval = 300000) {
  setInterval(() => {
    checkMemoryLeak();
  }, interval);

  log.info('Memory monitoring started', { interval: `${interval}ms` });
}

/**
 * Record a restart
 */
export function recordRestart() {
  systemMetrics.restarts++;
  log.info('Restart recorded', { total: systemMetrics.restarts });
}

/**
 * Record a crash
 */
export function recordCrash() {
  systemMetrics.crashes++;
  log.error('Crash recorded', { total: systemMetrics.crashes });
}

/**
 * Log metrics summary
 */
export function logMetricsSummary() {
  const metrics = getAllMetrics();

  log.info('Metrics Summary', {
    uptime: metrics.bot.uptime,
    memory: metrics.memory.heapUsed,
    requests: {
      total: metrics.requests.total,
      successRate: metrics.requests.successRate,
      avgResponseTime: metrics.requests.avgResponseTime
    },
    users: metrics.requests.uniqueUsers
  });
}

/**
 * Start periodic metrics logging
 * @param {number} interval - Log interval in ms (default: 1 hour)
 */
export function startMetricsLogging(interval = 3600000) {
  setInterval(() => {
    logMetricsSummary();
  }, interval);

  log.info('Metrics logging started', { interval: `${interval}ms` });
}

export default {
  getUptime,
  formatUptime,
  getMemoryStats,
  getCPUStats,
  getSystemInfo,
  getAllMetrics,
  checkMemoryLeak,
  startMemoryMonitoring,
  recordRestart,
  recordCrash,
  logMetricsSummary,
  startMetricsLogging
};
