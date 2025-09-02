module.exports = function(eleventyConfig) {
  // Tell Eleventy to copy static assets and images as‑is
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("images");

  // Helper filter to format dates in a human readable way
  eleventyConfig.addFilter("postDate", (dateObj) => {
    const date = new Date(dateObj);
    // Add the timezone offset to ensure the date displays correctly regardless of timezone
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const correctedDate = new Date(utc);
    return correctedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  // Create a custom collection that filters out automatic 'post' tags
  eleventyConfig.addCollection("post", function(collectionApi) {
    return collectionApi.getFilteredByGlob("posts/*.md").map(post => {
      // Remove the automatic 'post' tag if it exists
      if (post.data.tags && post.data.tags.includes('post')) {
        post.data.tags = post.data.tags.filter(tag => tag !== 'post');
      }
      return post;
    }).sort((a, b) => {
      return b.date - a.date; // Sort by date descending (newest first)
    });
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