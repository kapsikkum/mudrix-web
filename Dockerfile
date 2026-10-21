FROM node:22 AS builder
WORKDIR /app
COPY package*.json package-lock.json* ./
RUN npm install
COPY . .
ARG VITE_GIPHY_API_KEY
ARG VITE_KLIPY_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
