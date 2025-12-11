# ═══════════════════════════════════════════════════════════════
# MIDKNIGHT - Docker Configuration
# For VPS, Panel, and container deployments
# ═══════════════════════════════════════════════════════════════

FROM node:20-alpine

# Install dependencies for sharp, canvas, and other native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    ffmpeg \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create session directory
RUN mkdir -p session

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Run as non-root user for security
RUN addgroup -g 1001 -S midknight && \
    adduser -S midknight -u 1001 && \
    chown -R midknight:midknight /app

USER midknight

# Start the bot
CMD ["node", "index.js"]
