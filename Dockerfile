# Generated by https://smithery.ai. See: https://smithery.ai/docs/build/project-config
FROM node:lts-alpine

WORKDIR /app

# Install all dependencies (including dev deps for build)
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Install TypeScript globally for compilation
RUN npm install -g typescript

# Compile TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Start the server
CMD ["node", "dist/index.js"]
