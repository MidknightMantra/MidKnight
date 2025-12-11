export default {
    name: 'reload',
    alias: ['hotreload'],

    command: {
        pattern: 'reload',
        desc: 'Hot-reload plugins without restarting bot (owner only)',
        category: 'system',
        react: '🔄',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Owner only
            if (!msg.key.fromMe) {
                return sock.sendMessage(chat, {
                    text: '🔒 *Owner Only*\n\nThis command is restricted to the bot owner.'
                }, { quoted: msg });
            }

            try {
                await sock.sendMessage(chat, { react: { text: '🔄', key: msg.key } });
            } catch { }

            const pluginManager = global.MIDKNIGHT?.pluginManager;

            if (!pluginManager) {
                return sock.sendMessage(chat, {
                    text: '❌ Plugin manager not available'
                }, { quoted: msg });
            }

            const pluginName = args[0]?.toLowerCase();

            // Send loading message
            const loadingMsg = await sock.sendMessage(chat, {
                text: '🔄 *Reloading plugins...*\n\n_Please wait_'
            }, { quoted: msg });

            try {
                let result;
                let successCount = 0;
                let failCount = 0;

                if (pluginName) {
                    // Reload single plugin
                    try {
                        const reloaded = await pluginManager.reloadPlugin(pluginName);
                        if (reloaded) {
                            successCount = 1;
                            result = `✅ *Plugin Reloaded Successfully*\n\n📦 *Plugin:* ${pluginName}`;
                        } else {
                            failCount = 1;
                            result = `❌ *Failed to Reload Plugin*\n\n📦 *Plugin:* ${pluginName}\n\n_Plugin not found or failed to load_`;
                        }
                    } catch (error) {
                        failCount = 1;
                        result = `❌ *Reload Failed*\n\n📦 *Plugin:* ${pluginName}\n⚠️ *Error:* ${error.message}`;
                    }
                } else {
                    // Reload all plugins
                    const plugins = Array.from(pluginManager.plugins.values());
                    const results = [];

                    for (const plugin of plugins) {
                        try {
                            const reloaded = await pluginManager.reloadPlugin(plugin.name);
                            if (reloaded) {
                                successCount++;
                            } else {
                                failCount++;
                            }
                        } catch (error) {
                            failCount++;
                            console.error(`Failed to reload ${plugin.name}:`, error);
                        }
                    }

                    result = `🔄 *All Plugins Reloaded*\n\n✅ *Success:* ${successCount}\n❌ *Failed:* ${failCount}\n📦 *Total:* ${plugins.length}`;
                }

                // Edit loading message with result
                await sock.sendMessage(chat, {
                    text: result,
                    edit: loadingMsg.key
                });

            } catch (error) {
                await sock.sendMessage(chat, {
                    text: `❌ *Reload Failed*\n\n${error.message}`,
                    edit: loadingMsg.key
                });
            }
        }
    }
};
