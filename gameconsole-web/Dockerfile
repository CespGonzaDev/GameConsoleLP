# Stage 1: build estático con Node.js
FROM node:22-alpine AS builder

WORKDIR /app

# Dependencias reproducibles (package-lock.json obligatorio)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Nginx sirviendo el build y haciendo de proxy a GameStats y Prolog
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf
# envsubst de la imagen oficial lo convierte en /etc/nginx/conf.d/default.conf al arrancar
COPY default.conf.template /etc/nginx/templates/default.conf.template

ENV GAMESTATS_UPSTREAM=ingestion-go:8080 \
    PROLOG_UPSTREAM=prolog-ai-service:5000

EXPOSE 80

# 127.0.0.1 (no "localhost"): en alpine localhost puede resolver a ::1 y nginx escucha solo en IPv4
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
