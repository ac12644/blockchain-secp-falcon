"use strict";

// This command is unused — help is handled by bin/cli.js directly.
// Kept as a no-op so `cli help` resolves without error.

exports.alias = "h";
exports.description = "Show help";

exports.run = function () {
  // Re-invoke the usage printer from the entry point
  require("../../bin/cli.js");
};
