/**
 * Tests for Plugin Manager
 * Tests plugin loading, registration, and retrieval
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Mock the logger before importing pluginManager
vi.mock('../../src/utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    success: vi.fn()
  }
}));

// Mock fs to control which files are "in" the plugins directory
let mockPluginFiles = [];
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readdirSync: vi.fn((path) => {
      // Return mock plugin files when reading plugins directory
      if (path.includes('plugins')) {
        return mockPluginFiles;
      }
      return actual.readdirSync(path);
    })
  };
});

describe('PluginManager', () => {
  let PluginManager;
  let manager;

  beforeEach(async () => {
    // Clear module cache and reset mocks
    vi.clearAllMocks();
    mockPluginFiles = [];

    // Re-import pluginManager to get fresh instance
    // Note: This is tricky with singletons, so we test the existing instance
    const module = await import('../../src/pluginManager.js');
    manager = module.default;

    // Clear any existing plugins
    manager.plugins.clear();
    manager.commands.clear();
    manager.aliases.clear();
    manager.messageHandlers = [];
    manager.groupHandlers = [];
  });

  describe('loadPlugin', () => {
    it('should load a valid plugin', async () => {
      // Create a mock plugin
      const testPlugin = {
        name: 'test-plugin',
        command: {
          pattern: 'test',
          run: vi.fn()
        },
        alias: ['tp', 'testing'],
        desc: 'Test plugin'
      };

      // Mock the import
      vi.doMock(join(process.cwd(), 'plugins', 'test.js'), () => ({
        default: testPlugin
      }));

      // Load the plugin
      await manager.loadPlugin('test.js');

      // Verify plugin was registered
      expect(manager.plugins.has('test-plugin')).toBe(true);
      expect(manager.commands.has('test')).toBe(true);
      expect(manager.aliases.has('tp')).toBe(true);
      expect(manager.aliases.has('testing')).toBe(true);
    });

    it('should register multiple patterns for a plugin', async () => {
      const testPlugin = {
        name: 'multi-pattern',
        command: {
          pattern: ['cmd1', 'cmd2', 'cmd3']
        }
      };

      vi.doMock(join(process.cwd(), 'plugins', 'multi.js'), () => ({
        default: testPlugin
      }));

      await manager.loadPlugin('multi.js');

      expect(manager.commands.has('cmd1')).toBe(true);
      expect(manager.commands.has('cmd2')).toBe(true);
      expect(manager.commands.has('cmd3')).toBe(true);
    });

    it('should register message handlers', async () => {
      const testPlugin = {
        name: 'message-handler',
        command: { pattern: 'test' },
        onMessage: vi.fn()
      };

      vi.doMock(join(process.cwd(), 'plugins', 'handler.js'), () => ({
        default: testPlugin
      }));

      await manager.loadPlugin('handler.js');

      expect(manager.messageHandlers).toHaveLength(1);
      expect(manager.messageHandlers[0].name).toBe('message-handler');
    });

    it('should register group update handlers', async () => {
      const testPlugin = {
        name: 'group-handler',
        command: { pattern: 'test' },
        onGroupUpdate: vi.fn()
      };

      vi.doMock(join(process.cwd(), 'plugins', 'group.js'), () => ({
        default: testPlugin
      }));

      await manager.loadPlugin('group.js');

      expect(manager.groupHandlers).toHaveLength(1);
      expect(manager.groupHandlers[0].name).toBe('group-handler');
    });

    it('should throw error for invalid plugin structure', async () => {
      const invalidPlugin = {
        // Missing 'name' property
        command: { pattern: 'test' }
      };

      vi.doMock(join(process.cwd(), 'plugins', 'invalid.js'), () => ({
        default: invalidPlugin
      }));

      await expect(manager.loadPlugin('invalid.js')).rejects.toThrow('Invalid plugin structure');
    });

    it('should handle disabled plugins', async () => {
      const disabledPlugin = {
        name: 'disabled',
        command: { pattern: 'disabled' },
        enabled: false
      };

      vi.doMock(join(process.cwd(), 'plugins', 'disabled.js'), () => ({
        default: disabledPlugin
      }));

      await manager.loadPlugin('disabled.js');

      const plugin = manager.plugins.get('disabled');
      expect(plugin.enabled).toBe(false);
    });
  });

  describe('getByCommand', () => {
    beforeEach(async () => {
      // Setup test plugins
      const plugin1 = {
        name: 'plugin1',
        command: { pattern: 'cmd1' },
        alias: ['c1', 'command1']
      };

      vi.doMock(join(process.cwd(), 'plugins', 'p1.js'), () => ({
        default: plugin1
      }));

      await manager.loadPlugin('p1.js');
    });

    it('should retrieve plugin by direct command', () => {
      const plugin = manager.getByCommand('cmd1');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('plugin1');
    });

    it('should retrieve plugin by alias', () => {
      const plugin = manager.getByCommand('c1');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('plugin1');

      const plugin2 = manager.getByCommand('command1');
      expect(plugin2).toBeDefined();
      expect(plugin2.name).toBe('plugin1');
    });

    it('should be case insensitive', () => {
      const plugin = manager.getByCommand('CMD1');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('plugin1');

      const plugin2 = manager.getByCommand('C1');
      expect(plugin2).toBeDefined();
    });

    it('should return null for unknown command', () => {
      const plugin = manager.getByCommand('unknown');
      expect(plugin).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no plugins loaded', () => {
      const all = manager.getAll();
      expect(all).toEqual([]);
    });

    it('should return all loaded plugins', async () => {
      const plugin1 = {
        name: 'plugin1',
        command: { pattern: 'cmd1' }
      };
      const plugin2 = {
        name: 'plugin2',
        command: { pattern: 'cmd2' }
      };

      vi.doMock(join(process.cwd(), 'plugins', 'p1.js'), () => ({
        default: plugin1
      }));
      vi.doMock(join(process.cwd(), 'plugins', 'p2.js'), () => ({
        default: plugin2
      }));

      await manager.loadPlugin('p1.js');
      await manager.loadPlugin('p2.js');

      const all = manager.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(p => p.name)).toContain('plugin1');
      expect(all.map(p => p.name)).toContain('plugin2');
    });
  });

  describe('count', () => {
    it('should return 0 when no plugins loaded', () => {
      expect(manager.count).toBe(0);
    });

    it('should return correct count after loading plugins', async () => {
      const plugin1 = {
        name: 'plugin1',
        command: { pattern: 'cmd1' }
      };

      vi.doMock(join(process.cwd(), 'plugins', 'p1.js'), () => ({
        default: plugin1
      }));

      await manager.loadPlugin('p1.js');
      expect(manager.count).toBe(1);
    });
  });

  describe('reload', () => {
    it('should clear all plugins and reload', async () => {
      const plugin1 = {
        name: 'plugin1',
        command: { pattern: 'cmd1' }
      };

      vi.doMock(join(process.cwd(), 'plugins', 'p1.js'), () => ({
        default: plugin1
      }));

      await manager.loadPlugin('p1.js');
      expect(manager.count).toBe(1);

      // Mock empty plugins directory
      mockPluginFiles = [];

      await manager.reload();

      expect(manager.count).toBe(0);
      expect(manager.commands.size).toBe(0);
      expect(manager.aliases.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle plugins with pattern at root level', async () => {
      const plugin = {
        name: 'root-pattern',
        pattern: 'rootcmd'
      };

      vi.doMock(join(process.cwd(), 'plugins', 'root.js'), () => ({
        default: plugin
      }));

      await manager.loadPlugin('root.js');

      expect(manager.commands.has('rootcmd')).toBe(true);
    });

    it('should handle plugins without aliases', async () => {
      const plugin = {
        name: 'no-alias',
        command: { pattern: 'noalias' }
      };

      vi.doMock(join(process.cwd(), 'plugins', 'noalias.js'), () => ({
        default: plugin
      }));

      await manager.loadPlugin('noalias.js');

      expect(manager.plugins.has('no-alias')).toBe(true);
      // Should not crash without aliases
    });

    it('should handle plugins without command pattern', async () => {
      const plugin = {
        name: 'no-pattern',
        onMessage: vi.fn()
      };

      vi.doMock(join(process.cwd(), 'plugins', 'nopattern.js'), () => ({
        default: plugin
      }));

      await manager.loadPlugin('nopattern.js');

      // Should still register the message handler
      expect(manager.messageHandlers).toHaveLength(1);
    });

    it('should normalize command and alias case', async () => {
      const plugin = {
        name: 'mixed-case',
        command: { pattern: 'MiXeDCaSe' },
        alias: ['UPPER', 'lower', 'MiXeD']
      };

      vi.doMock(join(process.cwd(), 'plugins', 'mixed.js'), () => ({
        default: plugin
      }));

      await manager.loadPlugin('mixed.js');

      // Should all be stored lowercase
      expect(manager.commands.has('mixedcase')).toBe(true);
      expect(manager.aliases.has('upper')).toBe(true);
      expect(manager.aliases.has('lower')).toBe(true);
      expect(manager.aliases.has('mixed')).toBe(true);
    });
  });
});
