#!/bin/sh
# Запуск Phy.Sim на системном Electron. Флаги пользователя — из
# ~/.config/phy-sim-flags.conf (по одному на строку), как у других
# Electron-пакетов Arch: например --ozone-platform=x11, если Wayland капризничает.
flags_file="${XDG_CONFIG_HOME:-$HOME/.config}/phy-sim-flags.conf"
flags=""
[ -r "$flags_file" ] && flags=$(grep -v '^[[:space:]]*#' "$flags_file" | tr '\n' ' ')
# shellcheck disable=SC2086
exec electron /usr/lib/phy-sim $flags "$@"
