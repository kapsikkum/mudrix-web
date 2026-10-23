FROM node:22.14.0-bookworm-slim AS builder
WORKDIR /app
COPY package*.json package-lock.json* ./
RUN npm ci
COPY . .
ARG VITE_GIPHY_API_KEY
ARG VITE_KLIPY_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
