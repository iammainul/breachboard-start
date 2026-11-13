"use strict";
/**
 * Next's `server-only` package throws when loaded outside the RSC compiler.
 * Seed and other `tsx` CLI scripts import `lib/media/fs.ts`, which uses it to
 * keep filesystem helpers out of the browser bundle. Alias the package to a
 * no-op for Node CLI runs.
 */
const Module = require("module");
const path = require("path");

const empty = path.join(__dirname, "server-only-empty.cjs");
const original = Module._resolveFilename;
Module._resolveFilename = function resolveServerOnlyAlias(
  request,
  parent,
  isMain,
  options,
) {
  if (request === "server-only") return empty;
  return original.call(this, request, parent, isMain, options);
};
