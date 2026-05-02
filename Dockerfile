# Imagen mínima para servir la PWA con nginx (solo archivos estáticos).
FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
EXPOSE 80
