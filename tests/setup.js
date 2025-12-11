/**
 * Vitest global setup for Midknight Bot tests
 * Configures test environment and global mocks
 */

import { vi } from 'vitest';

// Mock environment variables for testing
process.env.BOT_NAME = 'MidknightTest';
process.env.PREFIX = '.';
process.env.OWNER_NUMBER = '1234567890';
process.env.MODE = 'public';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.SESSION_ID = '';
process.env.AUTO_READ = 'false';
process.env.AUTO_STATUS_READ = 'false';
process.env.AUTO_BIO = 'false';

// Mock Pino logger to reduce test output noise
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn()
    }))
  })
}));

// Mock pino-pretty (not needed in tests)
vi.mock('pino-pretty', () => ({
  default: vi.fn()
}));

// Mock qrcode-terminal (no QR codes in tests)
vi.mock('qrcode-terminal', () => ({
  default: {
    generate: vi.fn()
  }
}));

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
