import axios from 'axios';

const delay = (min = 120, max = 350) =>
  new Promise((r) => setTimeout(r, Math.floor(min + Math.random() * (max - min))));

/* -------------------------------------------------------------
   HELPER: Dynamic Weather Emojis
   Maps conditions from both OpenWeather and WMO codes
------------------------------------------------------------- */
function getWeatherIcon(id, isDay = true) {
  // OpenWeather ID logic (2xx - 8xx)
  if (id >= 200 && id < 300) return '⛈️'; // Thunderstorm
  if (id >= 300 && id < 500) return '🌧️'; // Drizzle
  if (id >= 500 && id < 600) return '🌧️'; // Rain
  if (id >= 600 && id < 700) return '❄️'; // Snow
  if (id >= 700 && id < 800) return '🌫️'; // Atmosphere (Fog/Mist)
  if (id === 800) return isDay ? '☀️' : '🌙'; // Clear
  if (id > 800) return '☁️'; // Clouds
  return '🌡️';
}

/* -------------------------------------------------------------
   GEOCODER: City -> Lat/Lon
   (We use Open-Meteo for geocoding because it's free and accurate)
------------------------------------------------------------- */
async function lookupCity(city) {
  try {
    const r = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    const loc = r.data?.results?.[0];
    if (!loc) return null;
    return {
      lat: loc.latitude,
      lon: loc.longitude,
      name: loc.name,
      country: loc.country || ''
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------
   API 0: GiftedTech (Priority)
------------------------------------------------------------- */
async function fetchGiftedWeather(city) {
  try {
    const { data } = await axios.get(`https://api.giftedtech.co.ke/api/search/weather?apikey=gifted&location=${encodeURIComponent(city)}`);
    const result = data.result;

    if (!result || !result.main) return null;

    return {
      source: 'GiftedTech',
      temp: result.main.temp,
      feels_like: result.main.feels_like,
      humidity: result.main.humidity,
      wind: result.wind?.speed || 'N/A',
      icon: '🌦️',
      desc: result.weather?.description || result.weather?.main || 'Unknown',
      location: result.location || city,
      country: result.sys?.country || ''
    };
  } catch (e) {
    return null;
  }
}

/* -------------------------------------------------------------
   API 1: OpenWeatherMap (PREMIUM / KEY REQUIRED)
------------------------------------------------------------- */
async function fetchOpenWeather(loc) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null; // Skip if no key

  try {
    const r = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&appid=${key}&units=metric`
    );

    const d = r.data;
    const weather = d.weather?.[0];
    const isDay = d.dt > d.sys.sunrise && d.dt < d.sys.sunset;

    return {
      source: 'OpenWeather (Key)',
      temp: d.main.temp,
      feels_like: d.main.feels_like,
      humidity: d.main.humidity,
      wind: (d.wind.speed * 3.6).toFixed(1), // Convert m/s to km/h
      icon: getWeatherIcon(weather?.id, isDay),
      desc: weather?.description ? weather.description.charAt(0).toUpperCase() + weather.description.slice(1) : 'Unknown',
      location: loc.name,
      country: loc.country
    };
  } catch (e) {
    console.log('OpenWeather Error (Check your Key):', e.response?.status);
    return null;
  }
}

/* -------------------------------------------------------------
   API 2: Open-Meteo (Free Fallback)
------------------------------------------------------------- */
async function fetchOpenMeteo(loc) {
  try {
    const r = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true`
    );
    const curr = r.data.current_weather;

    // Simple WMO Code mapping for icon
    let icon = '🌡️';
    if (curr.weathercode === 0) icon = '☀️';
    else if (curr.weathercode <= 3) icon = '☁️';
    else if (curr.weathercode <= 67) icon = '🌧️';
    else if (curr.weathercode >= 95) icon = '⛈️';

    return {
      source: 'Open-Meteo (Free)',
      temp: curr.temperature,
      feels_like: 'N/A', // OpenMeteo simple endpoint doesn't give feels_like
      humidity: 'N/A',
      wind: curr.windspeed,
      icon: icon,
      desc: 'WMO Code: ' + curr.weathercode,
      location: loc.name,
      country: loc.country
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------
   API 3: WTTR.in (Text Fallback)
------------------------------------------------------------- */
async function fetchWTTR(loc) {
  try {
    const r = await axios.get(`https://wttr.in/${encodeURIComponent(loc.name)}?format=j1`, { timeout: 5000 });
    const curr = r.data.current_condition?.[0];
    if (!curr) return null;

    return {
      source: 'WTTR.in',
      temp: curr.temp_C,
      feels_like: curr.FeelsLikeC,
      humidity: curr.humidity,
      wind: curr.windspeedKmph,
      icon: '🌥️',
      desc: curr.weatherDesc?.[0]?.value || 'Unknown',
      location: loc.name,
      country: loc.country
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------
   MASTER CONTROLLER
------------------------------------------------------------- */
export default {
  name: 'weather',
  alias: ['w', 'forecast'],

  command: {
    pattern: 'weather',
    desc: 'Get weather (OpenWeather Priority)',
    category: 'tools',
    react: '🌦️',

    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;

      if (!args.length) {
        return sock.sendMessage(chat, {
          text: '🌦️ *Usage:* .weather <city>\nExample: `.weather London`',
        }, { quoted: msg });
      }

      try { await sock.sendMessage(chat, { react: { text: '🌍', key: msg.key } }); } catch { }
      await delay();

      const city = args.join(' ');
      let data = null;

      // 0. Try GiftedTech (Direct City Lookup)
      data = await fetchGiftedWeather(city);

      // Fallback to Geocoding + Others if Gifted fails
      if (!data) {
        // 1. Locate City
        const loc = await lookupCity(city);
        if (loc) {
          // 2. Waterfall Fetch (Priority: Key -> Free -> Fallback)
          data = await fetchOpenWeather(loc);
          if (!data) data = await fetchOpenMeteo(loc);
          if (!data) data = await fetchWTTR(loc);
        }
      }

      if (!data) {
        return sock.sendMessage(chat, { text: '❌ Weather services are currently unreachable.' }, { quoted: msg });
      }

      // 3. Build Report
      let report = `╭━━━『 🌦️ MIDKNIGHT WEATHER 』━━━╮
┃
┃ 📍 *Location:* ${data.location}, ${data.country}
┃ ${data.icon} *Temp:* ${data.temp}°C
┃ 🌡️ *Feels:* ${data.feels_like}°C
┃ 📝 *Condition:* ${data.desc}
┃ 💨 *Wind:* ${data.wind} km/h
┃ 💧 *Humidity:* ${data.humidity}%
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

_“Forecast for today.”_`;

      return sock.sendMessage(chat, { text: report }, { quoted: msg });
    },
  },
};