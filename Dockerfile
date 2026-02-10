FROM node:20-slim

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-noto-cjk \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies (without postinstall to avoid double install)
RUN npm install --ignore-scripts

# Install Playwright Chromium
RUN npx playwright install chromium

# Copy server source
COPY server/ ./

# Build TypeScript
RUN npx tsc

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
