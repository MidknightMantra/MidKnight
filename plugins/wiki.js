import axios from 'axios';

/* -------------------------------------------------------
   ENGINE 1: Wikipedia Search API (More Flexible)
------------------------------------------------------- */
async function fetchWikipediaSearch(query) {
  try {
    const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'opensearch',
        search: query,
        limit: 1,
        format: 'json'
      },
      timeout: 8000
    });

    if (!data[1]?.[0]) return null;
    const title = data[1][0];
    const url = data[3]?.[0];
    const desc = data[2]?.[0];

    // Get full extract
    const { data: pageData } = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        format: 'json',
        prop: 'extracts|pageimages',
        titles: title,
        explaintext: 1,
        exintro: 1,
        pithumbsize: 500
      },
      timeout: 8000
    });

    const pages = pageData.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    return {
      title: page?.title || title,
      text: page?.extract || desc || 'No description.',
      image: page?.thumbnail?.source,
      url: url || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      source: 'Wikipedia'
    };
  } catch { return null; }
}

/* -------------------------------------------------------
   ENGINE 2: GiftedTech Wiki
------------------------------------------------------- */
async function fetchGiftedWiki(query) {
  try {
    const { data } = await axios.get(`https://api.giftedtech.co.ke/api/search/wikipedia?apikey=gifted&query=${encodeURIComponent(query)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const result = data.result || data;
    if (result && result.title) {
      return {
        title: result.title,
        text: result.extract || result.description || result.text || 'No description available.',
        image: result.image || result.thumbnail,
        url: result.url || result.link,
        source: 'GiftedTech'
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/* -------------------------------------------------------
   ENGINE 3: DuckDuckGo Instant Answer
------------------------------------------------------- */
async function fetchDuckDuckGo(query) {
  try {
    const { data } = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (data.Abstract && data.AbstractText) {
      return {
        title: data.Heading || query,
        text: data.AbstractText,
        image: data.Image,
        url: data.AbstractURL,
        source: 'DuckDuckGo'
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export default {
  name: 'wiki',
  alias: ['wikipedia', 'whatis', 'encyclopedia'],

  command: {
    pattern: 'wiki',
    desc: 'Search Wikipedia (Multi-Engine with Fallbacks)',
    category: 'education',
    react: '📚',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const query = args.join(' ');

      if (!query) {
        return await sock.sendMessage(chat, {
          text: '📚 *Wikipedia Search*\n\nUsage: `.wiki <topic>`\nExample: `.wiki Albert Einstein`'
        }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '🔍', key: msg.key } }); } catch { }

      try {
        // Waterfall: Try each engine
        let result = null;
        if (!result) result = await fetchWikipediaSearch(query);
        if (!result) result = await fetchGiftedWiki(query);
        if (!result) result = await fetchDuckDuckGo(query);

        if (!result) {
          return await sock.sendMessage(chat, {
            text: `❌ *Not Found*\n\nNo article found for "${query}".`
          }, { quoted: msg });
        }

        let sentImageMsg = null;

        // Send Image (only if it's a valid HTTP URL)
        if (result.image && result.image.startsWith('http')) {
          try {
            sentImageMsg = await sock.sendMessage(chat, {
              image: { url: result.image },
              caption: `📚 *${result.title}*`
            }, { quoted: msg });
            await new Promise(r => setTimeout(r, 500));
          } catch (imgErr) {
            // Image failed, continue without it
            console.error('Wiki image failed:', imgErr.message);
          }
        }

        // Send Detailed Text
        const finalMessage = `📚 *${result.title}*\n────────────────\n${result.text}\n────────────────\n🔗 [Read More](${result.url})\n⚙️ Source: ${result.source}`;

        const messageToQuote = sentImageMsg || msg;
        await sock.sendMessage(chat, { text: finalMessage }, { quoted: messageToQuote });

        try { await sock.sendMessage(chat, { react: { text: '✅', key: msg.key } }); } catch { }

      } catch (error) {
        if (error.code === 'ENOTFOUND') {
          return await sock.sendMessage(chat, { text: '❌ *Network Error:* Cannot reach Wikipedia services.' }, { quoted: msg });
        }
        console.error('Wiki Error:', error.message);
        await sock.sendMessage(chat, { text: '❌ Wiki system malfunction.' }, { quoted: msg });
      }
    }
  }
};