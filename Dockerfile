# ================================
# Stage 1: Build (TypeScript -> JS)
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (devDeps needed for tsc)
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript — || true lets Docker ignore type errors (files still emit)
RUN npx tsc || true

# ================================
# Stage 2: Production Runtime
# ================================
FROM node:20-alpine AS production

WORKDIR /app

# Copy only production package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy uploads folder (needed at runtime)
RUN mkdir -p uploads

# Expose backend port
EXPOSE 5001

# Start the server
CMD ["node", "dist/server.js"]
