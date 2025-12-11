import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'screenshot',
    alias: ['ss', 'ssweb', 'capture'],

    command: {
        pattern: 'screenshot',
        desc: 'Capture website screenshots (PC, Tablet, Phone)',
        category: 'tools',
        react: '📸',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;

            // Parse arguments
            // Usage: .ss <url> [device]
            // Devices: pc, tab, phone, web (default)

            let url = '';
            let device = 'web'; // Default to standard ssweb

            if (args.length > 0) {
                // Check if last arg is a device type
                const lastArg = args[args.length - 1].toLowerCase();
                if (['pc', 'tab', 'phone', 'web'].includes(lastArg)) {
                    device = lastArg;
                    url = args.slice(0, -1).join(' ');
                } else {
                    url = args.join(' ');
                }
            }

            if (!url) {
                return sock.sendMessage(chat, {
                    text: '📸 *Usage:* `.ss <url> [pc|tab|phone]`\nExample: `.ss https://google.com phone`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '📸', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '📸 *Midknight is capturing...*' }, { quoted: msg });

            try {
                let endpoint = 'ssweb';
                let deviceName = 'Standard Web';

                switch (device) {
                    case 'pc':
                        endpoint = 'sspc';
                        deviceName = 'PC / Desktop';
                        break;
                    case 'tab':
                    case 'tablet':
                        endpoint = 'sstab';
                        deviceName = 'Tablet';
                        break;
                    case 'phone':
                    case 'mobile':
                        endpoint = 'ssphone';
                        deviceName = 'Mobile Phone';
                        break;
                    default:
                        endpoint = 'ssweb';
                        deviceName = 'Standard Web';
                }

                const apiUrl = `https://api.giftedtech.co.ke/api/tools/${endpoint}?apikey=gifted&url=${encodeURIComponent(url)}`;

                // Fetch buffer
                const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

                // Check for JSON error
                try {
                    const json = JSON.parse(response.data.toString());
                    if (json.success === false || json.message) {
                        throw new Error('API Error');
                    }
                } catch (e) {
                    // Not JSON, likely image
                }

                await sock.sendMessage(chat, {
                    image: response.data,
                    caption: `╭━━━『 📸 MIDKNIGHT CAPTURE 』━━━╮
┃
┃ 🌐 *Target:* ${url}
┃ 📱 *Device:* ${deviceName}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Frozen in time.”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('Screenshot Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to capture screenshot.' }, { quoted: msg });
            }
        },
    },
};
