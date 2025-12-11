import axios from 'axios';

/* ---------------------------------------------------
   API HELPER
--------------------------------------------------- */
async function getGiftedApps(endpoint, query) {
    try {
        const url = `https://api.giftedtech.co.ke/api/search/${endpoint}?apikey=gifted&query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url);
        return data.result || data.results || data;
    } catch (e) {
        return null;
    }
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'apps',
    alias: ['playstore', 'ps', 'apkmirror', 'happymod', 'mod', 'apkdl', 'apk'],

    command: {
        pattern: 'apps',
        desc: 'Search or download Android Apps (PlayStore, APKMirror, HappyMod)',
        category: 'search',
        react: '📱',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const cmd = textContent.split(' ')[0].slice(1).toLowerCase();
            const query = args.join(' ');

            // DOWNLOAD MODE
            if (cmd === 'apkdl' || cmd === 'apk') {
                const appName = args.join(' ');
                if (!appName) {
                    return sock.sendMessage(chat, {
                        text: '📱 *Usage:* `.apkdl <app_name>`\nExample: `.apkdl WhatsApp`'
                    }, { quoted: msg });
                }

                try {
                    await sock.sendMessage(chat, { react: { text: '📥', key: msg.key } });
                    await sock.sendMessage(chat, { text: '📱 *Downloading APK...*' }, { quoted: msg });

                    const apiUrl = `https://api.giftedtech.co.ke/api/download/apkdl?apikey=gifted&appName=${encodeURIComponent(appName)}`;
                    const response = await axios.get(apiUrl);
                    const data = response.data?.result || response.data;

                    if (!data || !data.download_url) {
                        throw new Error('APK not found');
                    }

                    const name = data.name || data.title || appName;
                    const downloadUrl = data.download_url || data.url;
                    const icon = data.icon || data.thumbnail || data.image;
                    const size = data.size || 'Unknown';
                    const version = data.version || 'Unknown';

                    // Send info
                    const caption = `╭━━━『 📱 MIDKNIGHT APK 』━━━╮
┃
┃ 📦 *App:* ${name}
┃ 📊 *Size:* ${size}
┃ 🔢 *Version:* ${version}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"App Store at your fingertips."_`;

                    if (icon) {
                        await sock.sendMessage(chat, {
                            image: { url: icon },
                            caption: caption
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chat, { text: caption }, { quoted: msg });
                    }

                    // Send APK file
                    await sock.sendMessage(chat, {
                        document: { url: downloadUrl },
                        mimetype: 'application/vnd.android.package-archive',
                        fileName: `${name}.apk`
                    }, { quoted: msg });

                    try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

                } catch (e) {
                    console.error('APK Download Error:', e);
                    return sock.sendMessage(chat, { text: '❌ Failed to download APK.' }, { quoted: msg });
                }
                return;
            }

            // SEARCH MODE
            if (!query) {
                return sock.sendMessage(chat, {
                    text: `📱 *Usage:* \`.${cmd} <app_name>\`\nExample: \`.${cmd} WhatsApp\`\n\nOr download:\n\`.apkdl <app_name>\``
                }, { quoted: msg });
            }

            let endpoint = 'playstore';
            let title = 'Play Store';

            if (cmd === 'apkmirror') {
                endpoint = 'apkmirror';
                title = 'APK Mirror';
            } else if (cmd === 'happymod' || cmd === 'mod') {
                endpoint = 'happymod';
                title = 'HappyMod';
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '📱', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: `📱 *Midknight is searching ${title}...*` }, { quoted: msg });

            const results = await getGiftedApps(endpoint, query);

            if (!results || (Array.isArray(results) && results.length === 0)) {
                return sock.sendMessage(chat, { text: '❌ No apps found.' }, { quoted: msg });
            }

            // Format Results
            let formatted = '';

            if (Array.isArray(results)) {
                formatted = results.slice(0, 5).map((item) => {
                    const name = item.title || item.name || 'No Name';
                    const link = item.link || item.url || '#';
                    const dev = item.developer || item.dev || '';
                    const rating = item.rating || item.rate || '';

                    let details = '';
                    if (dev) details += `👨‍💻 ${dev} `;
                    if (rating) details += `⭐ ${rating}`;

                    return `🔹 *${name}*\n🔗 ${link}\n${details}`;
                }).join('\n\n');
            } else {
                // Fallback for single object
                const name = results.title || results.name || 'No Name';
                const link = results.link || results.url || '#';
                formatted = `🔹 *${name}*\n🔗 ${link}\n📝 ${results.description || ''}`;
            }

            await sock.sendMessage(chat, {
                text: `╭━━━『 📱 MIDKNIGHT ${title.toUpperCase()} 』━━━╮
┃
┃ 🔎 *Query:* ${query}
┃
${formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"App Store at your fingertips."_`
            }, { quoted: msg });

            try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }
        },
    },
};
