FROM node:18 AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del código
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine

# Copiar los archivos construidos
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto
EXPOSE 5173

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]