/**
 * Tests for Configuration Module
 * Tests environment variable parsing and defaults
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockEnv } from '../helpers/testUtils.js';

describe('Config', () => {
  let cleanup;

  beforeEach(() => {
    // Reset modules between tests
    vi.resetModules();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  describe('defaults', () => {
    it('should have default bot name', async () => {
      cleanup = mockEnv({ BOT_NAME: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.botName).toBe('Midknight');
    });

    it('should have default prefix', async () => {
      cleanup = mockEnv({ PREFIX: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.prefix).toBe('.');
    });

    it('should have default mode', async () => {
      cleanup = mockEnv({ BOT_MODE: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.mode).toBe('public');
    });

    it('should have default owner number', async () => {
      cleanup = mockEnv({ OWNER_NUMBER: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.ownerNumber).toEqual(['254700000000']);
    });

    it('should have default maxDownloadSize', async () => {
      cleanup = mockEnv({ MAX_DOWNLOAD_SIZE: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.maxDownloadSize).toBe(100);
    });
  });

  describe('environment variables', () => {
    it('should read BOT_NAME from env', async () => {
      cleanup = mockEnv({ BOT_NAME: 'TestBot' });
      const { default: config } = await import('../../src/config.js');
      expect(config.botName).toBe('TestBot');
    });

    it('should read PREFIX from env', async () => {
      cleanup = mockEnv({ PREFIX: '!' });
      const { default: config } = await import('../../src/config.js');
      expect(config.prefix).toBe('!');
    });

    it('should read SESSION_ID from env', async () => {
      cleanup = mockEnv({ SESSION_ID: 'test-session-123' });
      const { default: config } = await import('../../src/config.js');
      expect(config.sessionId).toBe('test-session-123');
    });

    it('should parse multiple owner numbers', async () => {
      cleanup = mockEnv({ OWNER_NUMBER: '1111111111, 2222222222, 3333333333' });
      const { default: config } = await import('../../src/config.js');
      expect(config.ownerNumber).toEqual(['1111111111', '2222222222', '3333333333']);
    });

    it('should trim whitespace from owner numbers', async () => {
      cleanup = mockEnv({ OWNER_NUMBER: ' 1111111111 ,  2222222222  ' });
      const { default: config } = await import('../../src/config.js');
      expect(config.ownerNumber).toEqual(['1111111111', '2222222222']);
    });

    it('should read BOT_MODE from env', async () => {
      cleanup = mockEnv({ BOT_MODE: 'private' });
      const { default: config } = await import('../../src/config.js');
      expect(config.mode).toBe('private');
    });

    it('should parse MAX_DOWNLOAD_SIZE as integer', async () => {
      cleanup = mockEnv({ MAX_DOWNLOAD_SIZE: '500' });
      const { default: config } = await import('../../src/config.js');
      expect(config.maxDownloadSize).toBe(500);
    });
  });

  describe('boolean flags', () => {
    it('should parse AUTO_READ as boolean', async () => {
      cleanup = mockEnv({ AUTO_READ: 'true' });
      let config = (await import('../../src/config.js')).default;
      expect(config.autoRead).toBe(true);

      vi.resetModules();
      cleanup = mockEnv({ AUTO_READ: 'false' });
      config = (await import('../../src/config.js')).default;
      expect(config.autoRead).toBe(false);
    });

    it('should default AUTO_TYPING to true', async () => {
      cleanup = mockEnv({ AUTO_TYPING: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.autoTyping).toBe(true);
    });

    it('should parse AUTO_TYPING=false', async () => {
      cleanup = mockEnv({ AUTO_TYPING: 'false' });
      const { default: config } = await import('../../src/config.js');
      expect(config.autoTyping).toBe(false);
    });

    it('should default AUTO_REACT to true', async () => {
      cleanup = mockEnv({ AUTO_REACT: undefined });
      const { default: config } = await import('../../src/config.js');
      expect(config.autoReact).toBe(true);
    });

    it('should parse AUTO_REACT=false', async () => {
      cleanup = mockEnv({ AUTO_REACT: 'false' });
      const { default: config } = await import('../../src/config.js');
      expect(config.autoReact).toBe(false);
    });

    it('should parse ANTI_CALL as boolean', async () => {
      cleanup = mockEnv({ ANTI_CALL: 'true' });
      let config = (await import('../../src/config.js')).default;
      expect(config.antiCall).toBe(true);

      vi.resetModules();
      cleanup = mockEnv({ ANTI_CALL: 'false' });
      config = (await import('../../src/config.js')).default;
      expect(config.antiCall).toBe(false);
    });

    it('should parse DEBUG as boolean', async () => {
      cleanup = mockEnv({ DEBUG: 'true' });
      let config = (await import('../../src/config.js')).default;
      expect(config.debug).toBe(true);

      vi.resetModules();
      cleanup = mockEnv({ DEBUG: 'false' });
      config = (await import('../../src/config.js')).default;
      expect(config.debug).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty SESSION_ID', async () => {
      cleanup = mockEnv({ SESSION_ID: '' });
      const { default: config } = await import('../../src/config.js');
      expect(config.sessionId).toBe('');
    });

    it('should handle invalid MAX_DOWNLOAD_SIZE', async () => {
      cleanup = mockEnv({ MAX_DOWNLOAD_SIZE: 'invalid' });
      const { default: config } = await import('../../src/config.js');
      expect(config.maxDownloadSize).toBe(100); // Should fallback to default
    });

    it('should handle single owner number without comma', async () => {
      cleanup = mockEnv({ OWNER_NUMBER: '1234567890' });
      const { default: config } = await import('../../src/config.js');
      expect(config.ownerNumber).toEqual(['1234567890']);
    });

    it('should have sessionDir property', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.sessionDir).toBe('./session');
    });
  });

  describe('valid modes', () => {
    it('should accept "public" mode', async () => {
      cleanup = mockEnv({ BOT_MODE: 'public' });
      const { default: config } = await import('../../src/config.js');
      expect(config.mode).toBe('public');
    });

    it('should accept "private" mode', async () => {
      cleanup = mockEnv({ BOT_MODE: 'private' });
      const { default: config } = await import('../../src/config.js');
      expect(config.mode).toBe('private');
    });

    it('should accept "groups" mode', async () => {
      cleanup = mockEnv({ BOT_MODE: 'groups' });
      const { default: config } = await import('../../src/config.js');
      expect(config.mode).toBe('groups');
    });
  });
});
