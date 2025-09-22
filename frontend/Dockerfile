# ---------- Build stage ----------
  FROM node:20-alpine AS builder
  WORKDIR /app
  
  # copy lockfiles first
  COPY frontend/package*.json ./
  
  # ensure devDependencies are installed (vite lives here)
  # (npm ci installs dev deps unless NODE_ENV=production)
  ENV NODE_ENV=development
  RUN npm ci --include=dev
  
  # now copy the rest and build
  COPY frontend/ ./
  # pass your Vite env at build-time if needed
  ARG VITE_API_BASE=/api
  ENV VITE_API_URL=$VITE_API_BASE
  RUN npm run build
  
    
# ---------- Serve stage ----------
    FROM nginx:1.27-alpine
    RUN apk add --no-cache curl
    
    # Config + built assets
    COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
    COPY --from=builder /app/dist /usr/share/nginx/html
    
    # Ensure the unprivileged 'nginx' user can write pid/cache/logs
    # and read configs/assets. NOTE: /run is where nginx writes nginx.pid.
    RUN mkdir -p /run /var/cache/nginx /var/run /var/log/nginx \
      && chown -R nginx:nginx /run /var/cache/nginx /var/run /var/log/nginx \
                         /etc/nginx /usr/share/nginx/html
    
    USER nginx
    EXPOSE 8080
    HEALTHCHECK --interval=30s --timeout=3s --retries=5 \
      CMD curl -fsS http://localhost:8080/ || exit 1