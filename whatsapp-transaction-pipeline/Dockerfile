FROM node:20-slim

# Install system dependencies: ffmpeg for audio conversion, python3 & pip for OCR/Whisper
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package definition files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy application source
COPY . .

# Build TypeScript
RUN npm run build

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start application server
CMD ["node", "dist/index.js"]
