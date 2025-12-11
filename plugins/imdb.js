import axios from 'axios';

/* ============================================================
   UTILS & CLEANUP
============================================================ */
function delay(min = 120, max = 350) {
  return new Promise((r) => setTimeout(r, Math.floor(min + Math.random() * (max - min))));
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '').trim();
}

function short(text, max = 800) {
  if (!text) return '';
  const clean = cleanText(text);
  return clean.length > max ? clean.slice(0, max - 80) + '\n\n... (truncated) ...' : clean;
}

/* ============================================================
   API 1: Gifted Tech (User Priority)
   Endpoint: movieapi.giftedtech.co.ke
============================================================ */
async function fetchGifted(query) {
  try {
    // Attempting standard search endpoint for Gifted Tech
    const url = `https://movieapi.giftedtech.co.ke/api/search?query=${encodeURIComponent(query)}`;

    // Set a short timeout so we fall back quickly if it's down
    const r = await axios.get(url, { timeout: 5000 });

    // Verify we have valid data (structure depends on their specific JSON response)
    const d = r.data?.result || r.data;
    if (!d || (!d.title && !d.name)) return null;

    return {
      source: 'GiftedTech',
      type: '🎬 Movie/Series',
      title: d.title || d.name,
      year: d.year || (d.release_date || '').slice(0, 4) || 'Unknown',
      released: d.release_date || d.released || 'Unknown',
      runtime: d.runtime || 'Unknown',
      genre: Array.isArray(d.genre) ? d.genre.join(', ') : (d.genre || 'Unknown'),
      director: d.director || 'Unknown',
      actors: d.actors || 'Unknown',
      plot: d.plot || d.overview || 'No summary available.',
      poster: d.poster || d.image || null,
      rating: d.rating ? `⭐ ${d.rating}` : null,
      trailer: d.trailer || null
    };
  } catch (e) {
    // Silently fail to next API
    return null;
  }
}

/* ============================================================
   API 2: OMDb (Best Metadata)
   Requires: process.env.OMDB_API_KEY
============================================================ */
async function fetchOMDb(query, isId = false) {
  try {
    const key = process.env.OMDB_API_KEY;
    if (!key) return null;

    const param = isId ? `i=${encodeURIComponent(query)}` : `t=${encodeURIComponent(query)}`;
    const url = `https://www.omdbapi.com/?${param}&plot=full&apikey=${key}`;

    const r = await axios.get(url, { timeout: 6000 });
    if (!r.data || r.data.Response === 'False') return null;

    return {
      source: 'OMDb',
      type: r.data.Type === 'series' ? '📺 TV Series' : '🎬 Movie',
      title: r.data.Title,
      year: r.data.Year,
      released: r.data.Released,
      runtime: r.data.Runtime,
      genre: r.data.Genre,
      director: r.data.Director,
      actors: r.data.Actors,
      plot: r.data.Plot,
      poster: r.data.Poster !== 'N/A' ? r.data.Poster : null,
      rating: r.data.imdbRating ? `⭐ ${r.data.imdbRating}/10 (IMDb)` : null,
      trailer: null
    };
  } catch { return null; }
}

/* ============================================================
   API 3: TMDB (Best Visuals)
   Uses Public Key
============================================================ */
const PUBLIC_TMDB_KEY = '1e3f2bb3e3d84e6c07d3e18c5fcc1f15';

async function fetchTMDB(query, isId = false) {
  try {
    const key = process.env.TMDB_API_KEY || PUBLIC_TMDB_KEY;
    let m;

    if (isId && query.startsWith('tt')) {
      const url = `https://api.themoviedb.org/3/find/${query}?api_key=${key}&external_source=imdb_id`;
      const r = await axios.get(url, { timeout: 6000 });
      m = r.data?.movie_results?.[0] || r.data?.tv_results?.[0];
    } else {
      const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&api_key=${key}&page=1`;
      const r = await axios.get(url, { timeout: 6000 });
      m = r.data?.results?.[0];
    }

    if (!m) return null;

    const type = m.media_type === 'tv' || m.first_air_date ? 'tv' : 'movie';
    const detailsUrl = `https://api.themoviedb.org/3/${type}/${m.id}?api_key=${key}&append_to_response=credits,videos`;
    const dRes = await axios.get(detailsUrl);
    const d = dRes.data;

    const director = (d.credits?.crew || []).find(c => c.job === 'Director')?.name || 'Unknown';
    const trailer = (d.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer')?.key;

    return {
      source: 'TMDB',
      type: type === 'tv' ? '📺 TV Series' : '🎬 Movie',
      title: d.title || d.name,
      year: (d.release_date || d.first_air_date || '').slice(0, 4),
      released: d.release_date || d.first_air_date,
      runtime: d.runtime ? `${d.runtime} min` : 'Unknown',
      genre: (d.genres || []).map(g => g.name).join(', '),
      director: director,
      actors: (d.credits?.cast || []).slice(0, 5).map(c => c.name).join(', '),
      plot: d.overview,
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      rating: d.vote_average ? `⭐ ${d.vote_average.toFixed(1)}/10` : null,
      trailer: trailer ? `https://youtu.be/${trailer}` : null
    };
  } catch { return null; }
}

/* ============================================================
   API 4: TVMaze (Series Fallback)
============================================================ */
async function fetchTVMaze(query) {
  try {
    const r = await axios.get(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`, { timeout: 5000 });
    const show = r.data?.[0]?.show;
    if (!show) return null;

    return {
      source: 'TVMaze',
      type: '📺 TV Series',
      title: show.name,
      year: (show.premiered || '').slice(0, 4),
      released: show.premiered,
      runtime: show.averageRuntime ? `${show.averageRuntime} min` : 'Unknown',
      genre: (show.genres || []).join(', '),
      director: 'Unknown',
      actors: 'N/A',
      plot: show.summary,
      poster: show.image?.original || show.image?.medium || null,
      rating: show.rating?.average ? `⭐ ${show.rating.average}/10` : null,
      trailer: null
    };
  } catch { return null; }
}

/* ============================================================
   API 5: iTunes (Movie Fallback)
============================================================ */
async function fetchITunes(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=movie&limit=1`;
    const r = await axios.get(url, { timeout: 5000 });
    const d = r.data?.results?.[0];
    if (!d) return null;

    return {
      source: 'iTunes',
      type: '🎬 Movie',
      title: d.trackName,
      year: (d.releaseDate || '').slice(0, 4),
      released: (d.releaseDate || '').split('T')[0],
      runtime: d.trackTimeMillis ? `${Math.floor(d.trackTimeMillis / 60000)} min` : 'Unknown',
      genre: d.primaryGenreName,
      director: d.artistName,
      actors: 'N/A',
      plot: d.longDescription || d.shortDescription,
      poster: d.artworkUrl100 ? d.artworkUrl100.replace('100x100bb', '600x600bb') : null,
      rating: null,
      trailer: d.previewUrl || null
    };
  } catch { return null; }
}

/* ============================================================
   MASTER CONTROLLER
============================================================ */
export default {
  name: 'imdb',
  command: {
    pattern: 'imdb',
    desc: 'Search Movies/Series (GiftedTech + Fallbacks)',
    category: 'media',
    react: '🎬',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      const query = args.join(' ').trim();

      if (!query) {
        return sock.sendMessage(chat, { text: '🎬 *Usage:* .imdb <Title>\nExample: .imdb Avengers' }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '🍿', key: msg.key } }); } catch { }

      // Random delay to simulate "thinking"
      await delay(200, 500);

      // === THE 5-TIER WATERFALL SEARCH ===

      // 1. Gifted Tech (Priority)
      let info = await fetchGifted(query);

      // 2. OMDb (Best Data)
      if (!info) info = await fetchOMDb(query, query.startsWith('tt'));

      // 3. TMDB (Best Images)
      if (!info) info = await fetchTMDB(query, query.startsWith('tt'));

      // 4. TVMaze (Series)
      if (!info) info = await fetchTVMaze(query);

      // 5. iTunes (Final fallback)
      if (!info) info = await fetchITunes(query);

      // === RESULTS ===
      if (!info) {
        return sock.sendMessage(chat, { text: `❌ No results found for *"${query}"* across 5 databases.` }, { quoted: msg });
      }



      // Construct Caption
      let caption = `${info.type}\n`;
      caption += `🎬 *${info.title}* (${info.year})\n`;
      caption += '──────────────\n';

      if (info.rating) caption += `${info.rating}\n`;
      caption += `🎭 *Genre:* ${info.genre}\n`;
      caption += `🕒 *Time:* ${info.runtime}\n`;
      caption += `📅 *Date:* ${info.released}\n`;

      if (info.director && info.director !== 'Unknown')
        caption += `📽️ *Director:* ${info.director}\n`;

      if (info.actors && info.actors !== 'N/A' && info.actors !== 'Unknown')
        caption += `👥 *Cast:* ${info.actors}\n`;

      caption += `\n📖 *Plot:*\n${short(info.plot, 600)}\n`;

      if (info.trailer) caption += `\n▶️ *Trailer:* ${info.trailer}\n`;

      caption += `\n🔍 Source: ${info.source}`;

      // Send
      if (info.poster) {
        await sock.sendMessage(chat, { image: { url: info.poster }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(chat, { text: caption }, { quoted: msg });
      }
    },
  },
};