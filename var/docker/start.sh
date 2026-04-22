#!/usr/bin/env sh
set -eu

PORT_TO_USE="${PORT:-5000}"
NGINX_TEMPLATE="/etc/nginx/nginx.conf.template"
NGINX_TARGET="/etc/nginx/nginx.conf"

if [ -f "$NGINX_TEMPLATE" ]; then
  sed "s/__PORT__/${PORT_TO_USE}/g" "$NGINX_TEMPLATE" > "$NGINX_TARGET"
fi

nginx
exec pnpm run pm2
