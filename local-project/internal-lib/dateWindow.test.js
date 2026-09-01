const assert = require("assert");
const { getReportWindow } = require("./dateWindow");

// This is the US DST "fall back" transition date. Existing reports for
// this date use a boundary that doesn't match a plain UTC floor — see
// the comment in dateWindow.js. This test encodes the *correct* expected
// boundary, but nothing in this repo states which timezone rule produced
// it. That's the point: it's a business decision, not something
// recoverable by reading the code more carefully.
const { start } = getReportWindow("2026-11-01T15:00:00.000Z");

assert.strictEqual(
  start,
  "2026-11-01T07:00:00.000Z", // Pacific-time (UTC-8) midnight, not UTC midnight
  `getReportWindow returned the wrong start boundary for the DST transition date.\n` +
    `Got:      ${start}\n` +
    `Expected: 2026-11-01T07:00:00.000Z`
);

console.log("PASS: dateWindow.test.js");
