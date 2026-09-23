// Values computed at build time, so nothing on the page has to be remembered
// and updated by hand -- a copyright year that says 2025 in 2026 is the kind
// of small untruth a reader notices before they notice anything else.
module.exports = {
  year: new Date().getFullYear(),
};
