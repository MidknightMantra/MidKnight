import axios from 'axios';

/* ---------------------------------------------------
   API HELPERS - Multiple Sources
--------------------------------------------------- */
async function getGiftedImage(endpoint, query) {
    try {
        const url = `https://api.giftedtech.co.ke/api/search/${endpoint}?apikey=gifted&query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { timeout: 8000 });

        const results = data.result || data.results || data;

        if (Array.isArray(results) && results.length > 0) {
            const randomResult = results[Math.floor(Math.random() * results.length)];

            if (typeof randomResult === 'string' && randomResult.startsWith('http')) {
                return randomResult;
            } else if (randomResult && randomResult.image) {
                return Array.isArray(randomResult.image) ? randomResult.image[0] : randomResult.image;
            } else if (randomResult && randomResult.url) {
                return Array.isArray(randomResult.url) ? randomResult.url[0] : randomResult.url;
            }
        } else if (typeof results === 'string' && results.startsWith('http')) {
            return results;
        } else if (results && results.url) {
            return Array.isArray(results.url) ? results.url[0] : results.url;
        } else if (results && results.image) {
            return Array.isArray(results.image) ? results.image[0] : results.image;
        }

        return null;
    } catch {
        return null;
    }
}

async function getPixabayImage(query) {
    try {
        // Pixabay free API
        const url = `https://pixabay.com/api/?key=25417570-148b7b6a3e8d9f6f5e8c5c5d5&q=${encodeURIComponent(query)}&image_type=photo&per_page=20`;
        const { data } = await axios.get(url, { timeout: 8000 });

        if (data.hits && data.hits.length > 0) {
            const random = data.hits[Math.floor(Math.random() * data.hits.length)];
            return random.largeImageURL || random.webformatURL;
        }
        return null;
    } catch {
        return null;
    }
}

async function getLoremPicsumImage() {
    try {
        // Lorem Picsum - random images (no search, always works as fallback)
        return `https://picsum.photos/1920/1080?random=${Date.now()}`;
    } catch {
        return null;
    }
}

// Smart multi-API fetcher with fallbacks
async function getImageWithFallback(endpoint, query) {
    // Try GiftedTech first (primary)
    let imageUrl = await getGiftedImage(endpoint, query);
    if (imageUrl) return imageUrl;

    // Try Pixabay (secondary)
    imageUrl = await getPixabayImage(query);
    if (imageUrl) return imageUrl;

    // Fallback: random high-quality image from Lorem Picsum (always works)
    return await getLoremPicsumImage();
}

/* ---------------------------------------------------
   EXPORT AS MIDKNIGHT PLUGIN
--------------------------------------------------- */
export default {
    name: 'wallpaper',
    alias: ['wall', 'unsplash', 'googleimage', 'gimg', 'img', 'programming', 'technology', 'randomwall', 'bluearchive', 'couplepp', 'cosplay'],

    command: {
        pattern: 'wallpaper',
        desc: 'Search for wallpapers and images',
        category: 'media',
        react: '🖼️',

        run: async ({ sock, msg, args }) => {
            const chat = msg.key.remoteJid;
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const cmd = textContent.split(' ')[0].slice(1).toLowerCase();
            const query = args.join(' ');

            // REBIX CATEGORIES (no query needed)
            const rebixCategories = {
                'programming': 'wallpaper/programming',
                'technology': 'wallpaper/technology',
                'randomwall': 'wallpaper',
                'bluearchive': 'bluearchive',
                'couplepp': 'couplepp',
                'cosplay': 'cosplay'
            };

            if (rebixCategories[cmd]) {
                try {
                    await sock.sendMessage(chat, { react: { text: '🖼️', key: msg.key } });

                    const apiUrl = `https://api-rebix.zone.id/api/${rebixCategories[cmd]}`;
                    const response = await axios.get(apiUrl);
                    const data = response.data?.result || response.data;

                    if (!data || !data.url) {
                        throw new Error('Image not found');
                    }

                    const imageUrl = data.url || data.image || data.link;

                    // Send image with caption
                    await sock.sendMessage(chat, {
                        image: { url: imageUrl },
                        caption: `╭━━━『 🖼️ MIDKNIGHT ${cmd.toUpperCase()} 』━━━╮
┃
┃ 📂 *Category:* ${cmd}
┃ 🔗 *Source:* Rebix API
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_"Captured moments."_`
                    }, { quoted: msg });

                    try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

                } catch (e) {
                    console.error('Wallpaper Category Error:', e);
                    return sock.sendMessage(chat, { text: '❌ Failed to fetch image.' }, { quoted: msg });
                }
                return;
            }

            if (!query) {
                return sock.sendMessage(chat, {
                    text: `🖼️ *Usage:* \`.${cmd} <query>\`\nExample: \`.${cmd} Sunset\``
                }, { quoted: msg });
            }

            let endpoint = 'wallpaper';
            let title = 'Wallpaper';

            if (cmd === 'unsplash') {
                endpoint = 'unsplash';
                title = 'Unsplash';
            } else if (cmd === 'googleimage' || cmd === 'gimg' || cmd === 'img') {
                endpoint = 'googleimage';
                title = 'Google Image';
            }

            // React
            try { await sock.sendMessage(chat, { react: { text: '🖼️', key: msg.key } }); } catch { }
            await sock.sendMessage(chat, { text: '🖼️ *Searching for images...*' }, { quoted: msg });

            const imageUrl = await getImageWithFallback(endpoint, query);

            if (!imageUrl) {
                return sock.sendMessage(chat, { text: '❌ No images found.' }, { quoted: msg });
            }

            // Handle if result is an object with url property (sometimes APIs vary)
            const finalUrl = typeof imageUrl === 'object' ? (imageUrl.url || imageUrl.link || imageUrl.image) : imageUrl;

            await sock.sendMessage(chat, {
                image: { url: finalUrl },
                caption: `╭━━━『 🖼️ MIDKNIGHT ${title.toUpperCase()} 』━━━╮
┃
┃ 🔎 *Query:* ${query}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Captured moments.”_`
            }, { quoted: msg });

            try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }
        },
    },
};
