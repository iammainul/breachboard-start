#!/bin/sh
set -eu

node ./docker/bootstrap.cjs

echo "Starting Next.js..."
exec node server.js
