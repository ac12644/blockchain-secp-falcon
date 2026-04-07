"use strict";

const path = require("path");
const fs = require("fs");

exports.alias = "v";
exports.description = "Show version";

exports.run = function () {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8")
  );
  console.log(`${pkg.name} v${pkg.version}`);
};
