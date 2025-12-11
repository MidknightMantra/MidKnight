/**
 * Test utilities and helpers for Midknight Bot tests
 */

import { vi } from 'vitest';
import { createMockSocket, createMockMessage } from '../mocks/baileys.mock.js';

/**
 * Setup a test environment with mock socket and utilities
 * @returns {object} Test environment
 */
export function setupTestEnvironment() {
  const sock = createMockSocket();

  return {
    sock,
    resetMocks: () => {
      vi.clearAllMocks();
    },
    getMockCalls: (method) => {
      return sock[method].mock.calls;
    },
    getLastCall: (method) => {
      const calls = sock[method].mock.calls;
      return calls[calls.length - 1];
    }
  };
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait (default: 0)
 * @returns {Promise<void>}
 */
export async function waitForAsync(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock file system operations
 * @returns {object} Mock fs operations
 */
export function mockFileSystem() {
  const files = new Map();

  return {
    readFileSync: vi.fn((path) => {
      if (files.has(path)) {
        return files.get(path);
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }),
    writeFileSync: vi.fn((path, data) => {
      files.set(path, data);
    }),
    existsSync: vi.fn((path) => {
      return files.has(path);
    }),
    unlinkSync: vi.fn((path) => {
      files.delete(path);
    }),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    files // Expose for testing
  };
}

/**
 * Create a spy on console methods
 * @returns {object} Console spies
 */
export function spyConsole() {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {})
  };
}

/**
 * Mock axios for HTTP requests
 * @returns {object} Mock axios instance
 */
export function mockAxios() {
  return {
    get: vi.fn(async (url) => ({
      data: { mock: true, url },
      status: 200,
      statusText: 'OK'
    })),
    post: vi.fn(async (url, data) => ({
      data: { mock: true, url, received: data },
      status: 200,
      statusText: 'OK'
    })),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn()
  };
}

/**
 * Create a test plugin
 * @param {object} overrides - Plugin properties to override
 * @returns {object} Test plugin
 */
export function createTestPlugin(overrides = {}) {
  return {
    name: 'test-plugin',
    alias: ['test', 'tp'],
    category: 'test',
    desc: 'Test plugin',
    react: '🧪',
    enabled: true,
    command: {
      pattern: 'test',
      run: vi.fn(async () => {})
    },
    ...overrides
  };
}

/**
 * Simulate a command execution
 * @param {object} options - Execution options
 * @returns {object} Execution context
 */
export async function simulateCommand(options = {}) {
  const {
    command = 'test',
    args = [],
    text = '',
    sender = '1234567890@s.whatsapp.net',
    chat = '1234567890@s.whatsapp.net',
    isGroup = false,
    isOwner = false
  } = options;

  const sock = createMockSocket();
  const msg = createMockMessage({ from: sender, chat, isGroup });

  const context = {
    sock,
    msg,
    args,
    text,
    chat,
    sender,
    isGroup,
    isOwner,
    command
  };

  return context;
}

/**
 * Assert message was sent
 * @param {object} sock - Mock socket
 * @param {object} expected - Expected message properties
 */
export function assertMessageSent(sock, expected = {}) {
  const calls = sock.sendMessage.mock.calls;

  if (calls.length === 0) {
    throw new Error('Expected sendMessage to be called, but it was not');
  }

  const lastCall = calls[calls.length - 1];
  const [jid, content, options] = lastCall;

  if (expected.jid && jid !== expected.jid) {
    throw new Error(`Expected message to ${expected.jid}, got ${jid}`);
  }

  if (expected.text && !content.text?.includes(expected.text)) {
    throw new Error(`Expected text to include "${expected.text}", got "${content.text}"`);
  }

  return { jid, content, options };
}

/**
 * Mock environment variables
 * @param {object} vars - Environment variables to set
 * @returns {Function} Cleanup function
 */
export function mockEnv(vars = {}) {
  const original = { ...process.env };

  Object.assign(process.env, vars);

  return () => {
    process.env = original;
  };
}

export default {
  setupTestEnvironment,
  waitForAsync,
  mockFileSystem,
  spyConsole,
  mockAxios,
  createTestPlugin,
  simulateCommand,
  assertMessageSent,
  mockEnv
};
