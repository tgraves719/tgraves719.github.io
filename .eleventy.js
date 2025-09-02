module.exports = function(eleventyConfig) {
  // Tell Eleventy to copy static assets and images as‑is
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("images");

  // Helper filter to format dates in a human readable way
  eleventyConfig.addFilter("postDate", (dateObj) => {
    const date = new Date(dateObj);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    templateFormats: ["md", "njk"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};