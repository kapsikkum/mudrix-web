FROM node:22.14.0-bookworm-slim AS builder
WORKDIR /app
COPY package*.json package-lock.json* ./
RUN npm ci
COPY . .
ARG VITE_GIPHY_API_KEY
ARG VITE_KLIPY_API_KEY
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
