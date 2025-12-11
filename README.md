# 🌙 Midknight

**Professional WhatsApp Bot** with 67+ plugins, session ID support, and multi-platform deployment.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?logo=whatsapp)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

- **67+ Plugins** - AI, downloaders, group admin, tools, entertainment & more
- **Session ID System** - Deploy anywhere with your `Vesperr~CODE` session ID
- **Multi-Platform** - Works on Railway, Heroku, Render, VPS, Docker, and terminals
- **Hot-Reload** - Update plugins without restarting
- **Anti-Features** - Anti-call, anti-link, anti-delete protection
- **Rich UI** - Beautiful formatted messages with reactions

---

## 🚀 Deployment
### Option 0: Pairing

1. Open [Pairer](https://midknightmantra-pair.onrender.com/)
2. Scan QR (working) or Enter phone number for pair code(not working)
3. Copy the session id sent to your dm

### Option 1: Railway (Recommended)

1. Fork this repository
2. Go to [Railway](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables:
   - `SESSION_ID` = Your session ID from the generator website
   - `OWNER_NUMBER` = Your phone number
4. Deploy!

### Option 2: Heroku

1. Fork this repository
2. Create new Heroku app
3. Connect to GitHub repo
4. Add Config Vars:
   - `SESSION_ID`
   - `OWNER_NUMBER`
5. Deploy → Enable Worker dyno (not Web)

### Option 3: Render

1. Fork this repository
2. Go to [Render](https://render.com) → New → Background Worker
3. Connect GitHub repo
4. Add environment variables
5. Deploy!

### Option 4: Panel / Pterodactyl

1. **Upload Files**: Upload all files to your server (zip -> upload -> unzip).
2. **Startup Command**: Set the startup command to:
   ```bash
   npm start
   ```
   *or*
   ```bash
   node index.js
   ```
3. **Environment**: Add variable `SESSION_ID` in the Startup/Variables tab.
4. **Build**: Run `npm install` (or click "Reinstall Server").
5. **Start**: improved support for automated restarts on panel.

### Option 5: VPS / Docker

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/Midknight.git
cd Midknight

# Using Docker
docker build -t midknight .
docker run -d --name midknight \
  -e SESSION_ID="Vesperr~YOUR_CODE" \
  -e OWNER_NUMBER="254700000000" \
  midknight

# Or using Node.js directly
npm install
SESSION_ID="Vesperr~YOUR_CODE" node index.js
```

### Option 5: Terminal (Development)

```bash
cd Midknight
npm install
node index.js
# Scan the QR code with WhatsApp
```

---

## 🔐 Session ID

Get your session ID from your session generator website. The format is:

```
Vesperr~aBcD1234
```

Set this as the `SESSION_ID` environment variable on any platform.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_ID` | Your session ID (from generator website) | - |
| `OWNER_NUMBER` | Your phone number (with country code) | - |
| `PREFIX` | Command prefix | `.` |
| `BOT_MODE` | `public`, `private`, or `groups` | `public` |
| `AUTO_REACT` | React with emoji on commands | `true` |
| `ANTI_CALL` | Reject incoming calls | `false` |
| `GEMINI_API_KEY` | Google Gemini API key (for AI) | - |
| `OPENAI_API_KEY` | OpenAI API key (for AI) | - |

---

## 📦 Plugin Categories

| Category | Plugins | Description |
|----------|---------|-------------|
| **AI** | `.ai`, `.gpt`, `.gemini` | AI chat with vision support |
| **Downloaders** | `.song`, `.video`, `.spotify` | YouTube, Spotify downloads |
| **Group** | `.kick`, `.add`, `.tagall` | Group administration |
| **Tools** | `.ping`, `.translate`, `.qr` | Utility commands |
| **Media** | `.sticker`, `.remini` | Image/video processing |
| **Fun** | `.joke`, `.truth`, `.dare` | Entertainment |
| **Search** | `.wiki`, `.weather`, `.lyrics` | Information lookup |

Use `.menu` to see all available commands.

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production
npm start
```

### Adding Custom Plugins

Create a new file in `plugins/` folder:

```javascript
export default {
  name: 'example',
  alias: ['ex', 'test'],
  desc: 'Example plugin',
  category: 'tools',
  react: '⚡',

  command: {
    pattern: 'example',
    run: async ({ sock, msg, args }) => {
      const chat = msg.key.remoteJid;
      await sock.sendMessage(chat, { text: 'Hello from Midknight!' }, { quoted: msg });
    }
  }
};
```

---

## 📄 License

MIT License - Created by MidKnightMantra

---

<p align="center">
  <b>🌙 Midknight - The Professional WhatsApp Bot</b>
</p>
