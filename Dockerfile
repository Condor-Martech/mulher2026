# ==================================
# Etapa 1: Construcción (Builder)
# ==================================
FROM node:20-alpine AS builder

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar configuración de dependencias
COPY package.json package-lock.json* ./

# Instalar las dependencias (ci es más rápido y seguro en pipelines)
# Nota: Usamos install normal ya que no hay lockfile garantizado en el entorno
RUN npm install

# Copiar todo el código fuente del proyecto
COPY . .

# Compilar Astro para producción (generar carpeta dist/)
RUN npm run build

# ==================================
# Etapa 2: Servidor (Runner)
# ==================================
FROM nginx:alpine AS runner

# Remover configuración por defecto de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Crear la estructura de subcarpeta para que el ruteo funcione sin config extra
RUN mkdir -p /usr/share/nginx/html/lp/mulher

# Copiar la compilación desde la etapa builder hacia la subcarpeta en Nginx
COPY --from=builder /app/dist /usr/share/nginx/html/lp/mulher

# Exponer el puerto 80 para el tráfico HTTP
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
