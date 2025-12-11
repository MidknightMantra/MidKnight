/**
 * Tests for Message Handler
 * Tests message routing, command parsing, and permission checks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockSocket, createMockMessage, createMockCommandMessage } from '../mocks/baileys.mock.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../src/config.js', () => ({
  default: {
    prefix: '.',
    mode: 'public',
    ownerNumber: ['1234567890'],
    autoReact: true,
    processSelfMessages: false
  }
}));

describe('MessageHandler', () => {
  let messageHandler;
  let pluginManager;
  let sock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh mock socket
    sock = createMockSocket();

    // Mock pluginManager
    pluginManager = {
      messageHandlers: [],
      groupHandlers: [],
      getByCommand: vi.fn(() => null)
    };

    vi.doMock('../../src/pluginManager.js', () => ({
      default: pluginManager
    }));

    // Import messageHandler after mocking dependencies
    const module = await import('../../src/messageHandler.js');
    messageHandler = module.default;
  });

  describe('extractText', () => {
    it('should extract text from conversation', () => {
      const message = { conversation: 'Hello World' };
      const text = messageHandler.extractText(message);
      expect(text).toBe('Hello World');
    });

    it('should extract text from extendedTextMessage', () => {
      const message = {
        extendedTextMessage: { text: 'Extended text' }
      };
      const text = messageHandler.extractText(message);
      expect(text).toBe('Extended text');
    });

    it('should extract caption from image', () => {
      const message = {
        imageMessage: { caption: 'Image caption' }
      };
      const text = messageHandler.extractText(message);
      expect(text).toBe('Image caption');
    });

    it('should extract caption from video', () => {
      const message = {
        videoMessage: { caption: 'Video caption' }
      };
      const text = messageHandler.extractText(message);
      expect(text).toBe('Video caption');
    });

    it('should return empty string for null message', () => {
      const text = messageHandler.extractText(null);
      expect(text).toBe('');
    });

    it('should return empty string for message without text', () => {
      const message = { someOtherType: {} };
      const text = messageHandler.extractText(message);
      expect(text).toBe('');
    });
  });

  describe('parseCommand', () => {
    it('should parse simple command', () => {
      const result = messageHandler.parseCommand('.test', '.');
      expect(result).toEqual({
        command: 'test',
        args: [],
        fullArgs: ''
      });
    });

    it('should parse command with arguments', () => {
      const result = messageHandler.parseCommand('.test arg1 arg2 arg3', '.');
      expect(result).toEqual({
        command: 'test',
        args: ['arg1', 'arg2', 'arg3'],
        fullArgs: 'arg1 arg2 arg3'
      });
    });

    it('should parse command with quoted arguments', () => {
      const result = messageHandler.parseCommand('.search "hello world" test', '.');
      expect(result).toEqual({
        command: 'search',
        args: ['"hello', 'world"', 'test'],
        fullArgs: '"hello world" test'
      });
    });

    it('should handle command with multiple spaces', () => {
      const result = messageHandler.parseCommand('.test    arg1    arg2', '.');
      expect(result).toEqual({
        command: 'test',
        args: ['arg1', 'arg2'],
        fullArgs: 'arg1    arg2'
      });
    });

    it('should return null for text without prefix', () => {
      const result = messageHandler.parseCommand('hello', '.');
      expect(result).toBeNull();
    });

    it('should return null for empty text', () => {
      const result = messageHandler.parseCommand('', '.');
      expect(result).toBeNull();
    });

    it('should return null for null text', () => {
      const result = messageHandler.parseCommand(null, '.');
      expect(result).toBeNull();
    });

    it('should be case insensitive for command', () => {
      const result = messageHandler.parseCommand('.TEST', '.');
      expect(result.command).toBe('test');
    });

    it('should handle different prefixes', () => {
      const result = messageHandler.parseCommand('!test', '!');
      expect(result).toEqual({
        command: 'test',
        args: [],
        fullArgs: ''
      });
    });
  });

  describe('handleMessage', () => {
    it('should skip messages without content', async () => {
      const msg = { key: { remoteJid: 'test@s.whatsapp.net' } };

      await messageHandler.handleMessage(sock, msg);

      expect(sock.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip status broadcasts', async () => {
      const msg = createMockMessage({
        text: '.test',
        chat: 'status@broadcast'
      });

      await messageHandler.handleMessage(sock, msg);

      expect(sock.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip self messages by default', async () => {
      const msg = createMockMessage({ text: '.test' });
      msg.key.fromMe = true;

      await messageHandler.handleMessage(sock, msg);

      expect(sock.sendMessage).not.toHaveBeenCalled();
    });

    it('should call onMessage handlers for all messages', async () => {
      const onMessageSpy = vi.fn();
      pluginManager.messageHandlers = [{
        name: 'test-listener',
        onMessage: onMessageSpy
      }];

      const msg = createMockMessage({ text: 'Hello' });

      await messageHandler.handleMessage(sock, msg);

      expect(onMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sock,
          msg,
          text: 'Hello'
        })
      );
    });

    it('should execute plugin command when found', async () => {
      const runSpy = vi.fn();
      const testPlugin = {
        name: 'test',
        command: { run: runSpy },
        enabled: true
      };

      pluginManager.getByCommand = vi.fn(() => testPlugin);

      const msg = createMockCommandMessage('test', 'arg1 arg2');

      await messageHandler.handleMessage(sock, msg);

      expect(pluginManager.getByCommand).toHaveBeenCalledWith('test');
      expect(runSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sock,
          msg,
          args: ['arg1', 'arg2'],
          text: 'arg1 arg2',
          command: 'test'
        })
      );
    });

    it('should not execute disabled plugins', async () => {
      const runSpy = vi.fn();
      const disabledPlugin = {
        name: 'disabled',
        command: { run: runSpy },
        enabled: false
      };

      pluginManager.getByCommand = vi.fn(() => disabledPlugin);

      const msg = createMockCommandMessage('disabled');

      await messageHandler.handleMessage(sock, msg);

      expect(runSpy).not.toHaveBeenCalled();
    });

    it('should respect private mode', async () => {
      // Update config to private mode
      const configModule = await import('../../src/config.js');
      configModule.default.mode = 'private';

      const runSpy = vi.fn();
      const testPlugin = {
        name: 'test',
        command: { run: runSpy },
        enabled: true
      };

      pluginManager.getByCommand = vi.fn(() => testPlugin);

      // Message from non-owner
      const msg = createMockCommandMessage('test', '', {
        from: '9999999999@s.whatsapp.net'
      });

      await messageHandler.handleMessage(sock, msg);

      expect(runSpy).not.toHaveBeenCalled();

      // Reset mode
      configModule.default.mode = 'public';
    });

    it('should respect groups mode', async () => {
      const configModule = await import('../../src/config.js');
      configModule.default.mode = 'groups';

      const runSpy = vi.fn();
      const testPlugin = {
        name: 'test',
        command: { run: runSpy },
        enabled: true
      };

      pluginManager.getByCommand = vi.fn(() => testPlugin);

      // DM message (not group)
      const msg = createMockCommandMessage('test', '', {
        chat: '1234567890@s.whatsapp.net',
        isGroup: false
      });

      await messageHandler.handleMessage(sock, msg);

      expect(runSpy).not.toHaveBeenCalled();

      // Reset mode
      configModule.default.mode = 'public';
    });

    it('should block non-owners from owner-only plugins', async () => {
      const runSpy = vi.fn();
      const ownerPlugin = {
        name: 'owner-cmd',
        command: { run: runSpy },
        enabled: true,
        ownerOnly: true
      };

      pluginManager.getByCommand = vi.fn(() => ownerPlugin);

      const msg = createMockCommandMessage('owner-cmd', '', {
        from: '9999999999@s.whatsapp.net' // Non-owner
      });

      await messageHandler.handleMessage(sock, msg);

      expect(runSpy).not.toHaveBeenCalled();
      expect(sock.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ text: expect.stringContaining('Owner Only') }),
        expect.any(Object)
      );
    });

    it('should allow owners to use owner-only plugins', async () => {
      const runSpy = vi.fn();
      const ownerPlugin = {
        name: 'owner-cmd',
        command: { run: runSpy },
        enabled: true,
        ownerOnly: true
      };

      pluginManager.getByCommand = vi.fn(() => ownerPlugin);

      const msg = createMockCommandMessage('owner-cmd', '', {
        from: '1234567890@s.whatsapp.net' // Owner
      });

      await messageHandler.handleMessage(sock, msg);

      expect(runSpy).toHaveBeenCalled();
    });

    it('should block DM for group-only plugins', async () => {
      const runSpy = vi.fn();
      const groupPlugin = {
        name: 'group-cmd',
        command: { run: runSpy },
        enabled: true,
        groupOnly: true
      };

      pluginManager.getByCommand = vi.fn(() => groupPlugin);

      const msg = createMockCommandMessage('group-cmd', '', {
        chat: '1234567890@s.whatsapp.net',
        isGroup: false
      });

      await messageHandler.handleMessage(sock, msg);

      expect(runSpy).not.toHaveBeenCalled();
      expect(sock.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ text: expect.stringContaining('Groups Only') }),
        expect.any(Object)
      );
    });

    it('should auto-react when enabled', async () => {
      const runSpy = vi.fn();
      const testPlugin = {
        name: 'test',
        command: { run: runSpy },
        enabled: true,
        react: '🎉'
      };

      pluginManager.getByCommand = vi.fn(() => testPlugin);

      const msg = createMockCommandMessage('test');

      await messageHandler.handleMessage(sock, msg);

      // Should send reaction
      expect(sock.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          react: expect.objectContaining({ text: '🎉' })
        })
      );

      expect(runSpy).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const runSpy = vi.fn(() => {
        throw new Error('Plugin error');
      });
      const testPlugin = {
        name: 'error-plugin',
        command: { run: runSpy },
        enabled: true
      };

      pluginManager.getByCommand = vi.fn(() => testPlugin);

      const msg = createMockCommandMessage('test');

      // Should not throw
      await expect(messageHandler.handleMessage(sock, msg)).resolves.not.toThrow();
    });
  });

  describe('handleGroupUpdate', () => {
    it('should call onGroupUpdate handlers', async () => {
      const onGroupUpdateSpy = vi.fn();
      pluginManager.groupHandlers = [{
        name: 'group-listener',
        onGroupUpdate: onGroupUpdateSpy
      }];

      const update = {
        id: '1234567890@g.us',
        participants: ['9999999999@s.whatsapp.net'],
        action: 'add'
      };

      await messageHandler.handleGroupUpdate(sock, update);

      expect(onGroupUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sock,
          update
        })
      );
    });

    it('should handle errors in group handlers', async () => {
      const onGroupUpdateSpy = vi.fn(() => {
        throw new Error('Group handler error');
      });
      pluginManager.groupHandlers = [{
        name: 'failing-group-listener',
        onGroupUpdate: onGroupUpdateSpy
      }];

      const update = {
        id: '1234567890@g.us',
        participants: ['9999999999@s.whatsapp.net'],
        action: 'add'
      };

      // Should not throw
      await expect(messageHandler.handleGroupUpdate(sock, update)).resolves.not.toThrow();
    });
  });
});
