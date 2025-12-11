import fs from 'fs';
import path from 'path';

/* -------------------------------------------------------
   CONFIG HANDLER
------------------------------------------------------- */
const CONFIG_DIR = path.join(process.cwd(), 'data/session/config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'anticall.json');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

function readCfg() {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
    catch { return { enabled: true, autoBlock: true, whitelist: [] }; }
}

function saveCfg(c) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
}

/* -------------------------------------------------------
   PLUGIN
------------------------------------------------------- */
export default {
    name: 'anticall',
    alias: ['ac', 'nocall'],
    desc: 'Reject and optionally block incoming calls',
    category: 'protection',
    permission: 'owner',

    command: {
        pattern: 'anticall',
        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const cfg = readCfg();
            const mode = args[0]?.toLowerCase();

            if (!mode) {
                const text = `📵 *ANTI-CALL PROTECTION*\n\n` +
                    `• Status: ${cfg.enabled ? '✅ Active' : '🔴 Disabled'}\n` +
                    `• Auto Block: ${cfg.autoBlock ? '🔒 Yes' : '🔓 No'}\n` +
                    `• Whitelisted: ${cfg.whitelist.length}\n\n` +
                    `*Usage:*\n` +
                    `• .anticall on/off\n` +
                    `• .anticall block on/off\n` +
                    `• .anticall whitelist @user\n` +
                    `• .anticall list`;
                return sock.sendMessage(chat, { text }, { quoted: msg });
            }

            if (mode === 'on') {
                cfg.enabled = true;
                saveCfg(cfg);
                return sock.sendMessage(chat, { text: '✅ Anti-Call is now *ACTIVE*.' }, { quoted: msg });
            }

            if (mode === 'off') {
                cfg.enabled = false;
                saveCfg(cfg);
                return sock.sendMessage(chat, { text: '✅ Anti-Call is now *DISABLED*.' }, { quoted: msg });
            }

            if (mode === 'block') {
                cfg.autoBlock = args[1] === 'on';
                saveCfg(cfg);
                return sock.sendMessage(chat, {
                    text: `✅ Auto-Block set to: *${cfg.autoBlock ? 'ON' : 'OFF'}*`
                }, { quoted: msg });
            }

            if (mode === 'whitelist' || mode === 'allow') {
                const quoted = msg.message?.extendedTextMessage?.contextInfo;
                const target = quoted?.participant || quoted?.mentionedJid?.[0];

                if (!target) {
                    return sock.sendMessage(chat, {
                        text: '❌ Reply to a user or mention them to whitelist.'
                    }, { quoted: msg });
                }

                if (cfg.whitelist.includes(target)) {
                    return sock.sendMessage(chat, {
                        text: '⚠️ User already whitelisted.'
                    }, { quoted: msg });
                }

                cfg.whitelist.push(target);
                saveCfg(cfg);
                return sock.sendMessage(chat, {
                    text: `✅ User whitelisted. They can call without being rejected.`,
                    mentions: [target]
                }, { quoted: msg });
            }

            if (mode === 'list') {
                if (cfg.whitelist.length === 0) {
                    return sock.sendMessage(chat, {
                        text: '📝 *WHITELISTED USERS*\n\nNo users whitelisted yet.'
                    }, { quoted: msg });
                }
                const list = `📝 *WHITELISTED USERS* (${cfg.whitelist.length})\n\n` +
                    cfg.whitelist.map((u, i) => `${i + 1}. @${u.split('@')[0]}`).join('\n');
                return sock.sendMessage(chat, {
                    text: list,
                    mentions: cfg.whitelist
                }, { quoted: msg });
            }

            return sock.sendMessage(chat, {
                text: '❌ Invalid usage. Use `.anticall` for help.'
            }, { quoted: msg });
        }
    },

    // EVENT HOOK for incoming calls
    onCall: async ({ sock, events }) => {
        const cfg = readCfg();
        if (!cfg.enabled) return;

        for (const call of events) {
            if (call.status !== 'offer') continue;

            const callerId = call.from;
            if (cfg.whitelist.includes(callerId)) continue;

            console.log(`[AntiCall] Rejecting call from ${callerId}`);

            try {
                // 1. Reject Call
                await sock.rejectCall(call.id, callerId);

                // 2. Send Warning
                await sock.sendMessage(callerId, {
                    text: '📵 *No Calls Allowed*\n\n' +
                        'Please text me instead.\n' +
                        'Persistent calling will result in a block.'
                });

                // 3. Block if enabled
                if (cfg.autoBlock) {
                    await new Promise(r => setTimeout(r, 2000));
                    await sock.updateBlockStatus(callerId, 'block');
                    console.log(`[AntiCall] Blocked ${callerId}`);
                }
            } catch (e) {
                console.error('[AntiCall] Action failed:', e.message);
            }
        }
    }
};
