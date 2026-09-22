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

  // --- Essays ---------------------------------------------------------
  // Essays are arguments; the blog is the record of making things. They are
  // different kinds of writing with different readers, so they are different
  // collections rather than one collection with a `contentType` filter --
  // which is what the old site did, and which is why a 56-word photo caption
  // and a history of jazz innovation sat side by side under "essay".
  //
  // An essay may later carry a video: `videoId` in front matter turns the
  // written piece into the companion text for a video essay. Until that field
  // is filled the page says nothing about video at all.
  eleventyConfig.addCollection("essay", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("essays/*.md")
      .sort((a, b) => b.date - a.date);
  });

  // --- Project wiring -------------------------------------------------
  // Posts declare which project they belong to via `project:` front matter
  // ("portraits-of-change", "conductvr", "musicstand"). These filters let a
  // work page render its own posts from the collection instead of a
  // hand-maintained copy of the same data.

  // Posts belonging to one project, newest first.
  eleventyConfig.addFilter("byProject", (posts, project) => {
    if (!posts || !project) return [];
    return posts
      .filter((p) => p.data.project === project)
      .sort((a, b) => b.date - a.date);
  });

  // Narrow to one contentType (e.g. "devlog").
  eleventyConfig.addFilter("byType", (posts, contentType) => {
    if (!posts || !contentType) return [];
    return posts.filter((p) => p.data.contentType === contentType);
  });

  // Plain-text opening of a post, for card blurbs.
  eleventyConfig.addFilter("excerptText", (content, length = 180) => {
    if (!content) return "";
    const text = String(content)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= length) return text;
    return text.slice(0, text.lastIndexOf(" ", length) || length).trim() + "…";
  });

  // Shape posts into the minimal record the project-page cards need, and
  // carry Eleventy's own `url` so links can never drift from reality.
  eleventyConfig.addFilter("toCardData", (posts) => {
    if (!posts) return [];
    const plain = (s, n = 170) => {
      const t = String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!t) return "";
      return t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n) || n).trim() + "…";
    };
    // Post front matter stores image paths site-root-relative but without a
    // leading slash ("images/pic04.jpg"), so every consumer has to add one.
    // Cards render from a nested URL, where the bare path 404s.
    const rooted = (src) => {
      if (!src) return null;
      if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
      return "/" + src.replace(/^\.?\//, "");
    };
    return posts.map((p) => {
      // templateContent can throw if read before the post has rendered;
      // the blurb is a nicety, so degrade rather than fail the build.
      let blurb = "";
      try { blurb = plain(p.templateContent); } catch (e) { blurb = ""; }
      return {
        url: p.url,
        title: p.data.title || "",
        date: p.date ? p.date.toISOString().slice(0, 10) : "",
        videoId: p.data.videoId || null,
        image: rooted(p.data.image),
        contentType: p.data.contentType || "",
        text: blurb,
      };
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