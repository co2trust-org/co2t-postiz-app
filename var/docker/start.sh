#!/usr/bin/env sh
set -eu

PORT_TO_USE="${PORT:-5000}"
# Nginx owns $PORT; Nest must listen on a separate fixed port the proxy expects.
export BACK_END_PORT="${BACK_END_PORT:-3000}"
NGINX_TEMPLATE="/etc/nginx/nginx.conf.template"
NGINX_TARGET="/etc/nginx/nginx.conf"

if [ -f "$NGINX_TEMPLATE" ]; then
  sed "s/__PORT__/${PORT_TO_USE}/g" "$NGINX_TEMPLATE" > "$NGINX_TARGET"
fi

nginx
exec pnpm run pm2
