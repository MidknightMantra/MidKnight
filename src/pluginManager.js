/* ═══════════════════════════════════════════════════════════════
   MIDKNIGHT - Plugin Manager
   Dynamic plugin loader with hot-reload support
   ═══════════════════════════════════════════════════════════════ */

import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, '..', 'plugins');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.commands = new Map();      // pattern -> plugin
        this.aliases = new Map();       // alias -> pattern
        this.messageHandlers = [];      // plugins with onMessage
        this.statusHandlers = [];       // plugins with onStatus
        this.groupHandlers = [];        // plugins with onGroupUpdate
    }

    /**
     * Load all plugins from the plugins directory
     */
    async loadAll() {
        log.info('Loading plugins...');

        const files = readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
        let loaded = 0;
        let failed = 0;

        for (const file of files) {
            try {
                await this.loadPlugin(file);
                loaded++;
            } catch (error) {
                log.error(`Failed to load ${file}`, { error: error.message });
                failed++;
            }
        }

        log.success(`Loaded ${loaded} plugins (${failed} failed)`);
        return { loaded, failed };
    }

    /**
     * Load a single plugin
     * @param {string} filename - Plugin filename
     */
    async loadPlugin(filename) {
        const filePath = join(PLUGINS_DIR, filename);

        // Dynamic import with cache busting for hot-reload
        // Skip cache busting in tests to allow mocking
        const moduleUrl = process.env.VITEST
            ? `file://${filePath}`
            : `file://${filePath}?update=${Date.now()}`;
        const module = await import(moduleUrl);
        const plugin = module.default;

        if (!plugin || !plugin.name) {
            throw new Error('Invalid plugin structure');
        }

        // Get command pattern(s)
        const pattern = plugin.pattern || plugin.command?.pattern;
        if (pattern) {
            const patterns = Array.isArray(pattern) ? pattern : [pattern];

            // Register plugin
            this.plugins.set(plugin.name, {
                ...plugin,
                filename,
                pattern: patterns[0],
                enabled: plugin.enabled !== false
            });

            // Register commands
            for (const p of patterns) {
                this.commands.set(p.toLowerCase(), plugin.name);
            }

            // Register aliases
            if (plugin.alias && Array.isArray(plugin.alias)) {
                for (const alias of plugin.alias) {
                    this.aliases.set(alias.toLowerCase(), patterns[0].toLowerCase());
                }
            }
        }

        // Register message handlers
        if (typeof plugin.onMessage === 'function') {
            this.messageHandlers.push(plugin);
        }

        // Register status handlers
        if (typeof plugin.onStatus === 'function') {
            this.statusHandlers.push(plugin);
        }

        // Register group update handlers
        if (typeof plugin.onGroupUpdate === 'function') {
            this.groupHandlers.push(plugin);
        }

        log.debug(`Loaded: ${plugin.name}`);
    }

    /**
     * Reload all plugins (hot-reload)
     */
    async reload() {
        this.plugins.clear();
        this.commands.clear();
        this.aliases.clear();
        this.messageHandlers = [];
        this.statusHandlers = [];
        this.groupHandlers = [];

        return await this.loadAll();
    }

    /**
     * Get a plugin by command or alias
     * @param {string} cmd - Command or alias
     * @returns {object|null} Plugin object
     */
    getByCommand(cmd) {
        const cmdLower = cmd.toLowerCase();

        // Check direct command
        let pluginName = this.commands.get(cmdLower);

        // Check alias
        if (!pluginName) {
            const pattern = this.aliases.get(cmdLower);
            if (pattern) {
                pluginName = this.commands.get(pattern);
            }
        }

        if (!pluginName) return null;

        return this.plugins.get(pluginName);
    }

    /**
     * Reload a single plugin by name
     * @param {string} pluginName - Name of the plugin to reload
     * @returns {boolean} Success status
     */
    async reloadPlugin(pluginName) {
        try {
            // Find the plugin file
            const filename = `${pluginName}.js`;
            const filePath = join(PLUGINS_DIR, filename);

            if (!existsSync(filePath)) {
                log.error(`Plugin file not found: ${filename}`);
                return false;
            }

            // Remove old registrations
            const oldPlugin = this.plugins.get(pluginName);
            if (oldPlugin) {
                // Remove command registrations
                if (oldPlugin.pattern) { // Use oldPlugin.pattern which is the first pattern
                    this.commands.delete(oldPlugin.pattern.toLowerCase());
                    if (oldPlugin.alias) {
                        oldPlugin.alias.forEach(a => this.aliases.delete(a.toLowerCase()));
                    }
                }
                this.plugins.delete(pluginName);
            }

            // Remove from handler arrays
            this.messageHandlers = this.messageHandlers.filter(p => p.name !== pluginName);
            this.statusHandlers = this.statusHandlers.filter(p => p.name !== pluginName);
            this.groupHandlers = this.groupHandlers.filter(p => p.name !== pluginName);

            // Reload the plugin (ES modules use dynamic import with cache busting)
            await this.loadPlugin(filename);

            log.info(`Reloaded plugin: ${pluginName}`);
            return true;
        } catch (error) {
            log.error(`Failed to reload plugin ${pluginName}:`, error);
            return false;
        }
    }

    /**
     * Get all plugins as array
     * @returns {Array} All plugins
     */
    getAll() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugin count
     * @returns {number}
     */
    get count() {
        return this.plugins.size;
    }
}

// Singleton instance
const pluginManager = new PluginManager();
export default pluginManager;
