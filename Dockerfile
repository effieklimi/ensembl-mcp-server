FROM node:lts-alpineAdd commentMore actions

WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm install --production

# Copy source code
COPY . .

# Install esbuild for bundling
RUN npm install esbuild --no-save

# Bundle TypeScript into a single JavaScript file
RUN mkdir dist && npx esbuild src/index.ts \
  --bundle --platform=node --format=esm \
  --external:@modelcontextprotocol/sdk/server/index.js \
  --external:@modelcontextprotocol/sdk/server/stdio.js \
  --external:@modelcontextprotocol/sdk/types.js \
  --outfile=dist/index.js

# Start the server
CMD ["node", "dist/index.js"]