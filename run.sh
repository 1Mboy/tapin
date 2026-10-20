#!/usr/bin/env bash
# Restart-on-crash loop for Tap.in (binds 127.0.0.1:41209 only)
cd "$(dirname "$0")"
while true; do
  echo "[$(date)] starting server" >> data/server.log
  PORT=41209 HOST=127.0.0.1 node server.js >> data/server.log 2>&1
  echo "[$(date)] server exited with $? — restarting in 2s" >> data/server.log
  sleep 2
done
