#!/bin/sh
set -eu

sqlite_data_dir="${SQLITE_DATA_DIR:-/app/data}"
case "$sqlite_data_dir" in
  /*) ;;
  *) sqlite_data_dir="/app/$sqlite_data_dir" ;;
esac

mkdir -p "$sqlite_data_dir"
chown -R node:node "$sqlite_data_dir"

exec su-exec node:node "$@"
