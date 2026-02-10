# Use official Playwright image - Chromium already installed
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies (skip postinstall - Chromium already in image)
RUN npm install --ignore-scripts

# Copy server source
COPY server/ ./

# Build TypeScript
RUN npx tsc

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
