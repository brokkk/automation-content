# Use official Playwright image for system dependencies
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies (skip postinstall to control install order)
RUN npm install --ignore-scripts

# Install Chromium matching the installed Playwright version
RUN npx playwright install chromium

# Copy server source
COPY server/ ./

# Build TypeScript
RUN npx tsc

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
