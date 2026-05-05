# Imagen estatica reproducible para servir la PWA con nginx-unprivileged.
#
# Para builds totalmente deterministas, antes de publicar resuelve el digest
# real y reemplaza el tag por:
#   FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:<digest>
#
# Obtener el digest:
#   docker pull nginxinc/nginx-unprivileged:1.27-alpine
#   docker inspect nginxinc/nginx-unprivileged:1.27-alpine --format '{{index .RepoDigests 0}}'
#
# El tag esta pinneado a major.minor (1.27) para evitar cambios mayores no
# anunciados; el digest se gestiona en el pipeline de release.
FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN rm -rf /usr/share/nginx/html/*
COPY --chown=nginx:nginx nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx index.html informe.html manifest.json sw.js styles.css \
    icon-180.png icon-192.png icon-512.png /usr/share/nginx/html/
COPY --chown=nginx:nginx js /usr/share/nginx/html/js
COPY --chown=nginx:nginx config /usr/share/nginx/html/config

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1
