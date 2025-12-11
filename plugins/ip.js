import axios from 'axios';

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'ip',
    alias: ['ipstalk', 'ipinfo', 'trace'],

    command: {
        pattern: 'ip',
        desc: 'Get information about an IP address',
        category: 'tools',
        react: '🌐',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const ip = args[0];

            if (!ip) {
                return sock.sendMessage(chat, {
                    text: '🌐 *Usage:* `.ip <address>`\nExample: `.ip 8.8.8.8`'
                }, { quoted: msg });
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '🌐', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '🌐 *Midknight is tracing IP...*' }, { quoted: msg });

            try {
                const apiUrl = `https://api.giftedtech.co.ke/api/stalk/ipstalk?apikey=gifted&address=${encodeURIComponent(ip)}`;

                const response = await axios.get(apiUrl);
                const data = response.data?.result || response.data;

                if (!data) {
                    throw new Error('No data found');
                }

                // Format Results
                // Assuming typical IP info fields
                const country = data.country || data.countryName || 'Unknown';
                const region = data.region || data.regionName || 'Unknown';
                const city = data.city || 'Unknown';
                const isp = data.isp || data.org || 'Unknown';
                const zip = data.zip || data.postal || 'Unknown';
                const timezone = data.timezone || 'Unknown';
                const lat = data.lat || data.latitude || '0';
                const lon = data.lon || data.longitude || '0';

                await sock.sendMessage(chat, {
                    text: `╭━━━『 🌐 MIDKNIGHT IP TRACE 』━━━╮
┃
┃ 📌 *IP:* ${ip}
┃ 🌍 *Country:* ${country}
┃ 🏙️ *Region:* ${region}, ${city}
┃ 📮 *Zip:* ${zip}
┃ 🏢 *ISP:* ${isp}
┃ 🕒 *Timezone:* ${timezone}
┃ 📍 *Coords:* ${lat}, ${lon}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Digital footprint.”_`
                }, { quoted: msg });

                try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

            } catch (e) {
                console.error('IP Error:', e);
                return sock.sendMessage(chat, { text: '❌ Failed to trace IP.' }, { quoted: msg });
            }
        },
    },
};
