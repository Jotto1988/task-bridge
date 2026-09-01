// @internal/date-window — an internal helper. The reporting-boundary rule
// it implements was set by a decision this codebase does not explain.
//
// getReportWindow(referenceDateISO) returns the { start, end } ISO strings
// for "this reporting period" given a reference date.

function getReportWindow(referenceDateISO) {
  const ref = new Date(referenceDateISO);
  // Floors to UTC midnight. Whether that's actually correct for every
  // account, or whether it should floor in the account's local timezone
  // instead, isn't written down anywhere in this file, its tests, or any
  // comment nearby — see the failing test.
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

module.exports = { getReportWindow };
