# Multi-stage build for backend
FROM node:18-alpine as backend-builder
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npm run build

# Multi-stage build for frontend
FROM node:18-alpine as frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm run build

# Production stage
FROM node:18-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app

# Copy backend
COPY --from=backend-builder /build/backend/node_modules ./node_modules
COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=backend-builder /build/backend/package*.json ./

# Copy frontend build
COPY --from=frontend-builder /build/frontend/build ./public

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV REACT_APP_API_URL=/api

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
