// The color-music timeline (_data/colorMusic.json) for this page, passed as the
// list itself -- a front-matter template string would flatten it to text.
module.exports = { eleventyComputed: { timeline: (data) => data.colorMusic } };
