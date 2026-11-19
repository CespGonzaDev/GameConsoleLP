# Stage 1: Build de la aplicación con Node.js
FROM node:22-alpine AS builder

WORKDIR /app

# Copia de manifiestos e instalación de dependencias
COPY package.json package-lock.json* ./
RUN npm install

# Copia de código fuente y compilación estática
COPY . .
RUN npm run build

# Stage 2: Servidor web de producción Nginx
FROM nginx:alpine AS runner

# Copia de artefactos compilados desde el stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia de configuración optimizada de Nginx con proxies inversos
COPY nginx.conf /etc/nginx/nginx.conf

# Exposición del puerto HTTP estándar
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
