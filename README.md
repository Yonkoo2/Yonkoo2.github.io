# YonKoo Hexo Site

This repository is set up as a Hexo 8.1.1 site using the local `fett` theme.

The root HTML/CSS/JS files are the currently published GitHub Pages output. The Hexo source lives in:

- `_config.yml`
- `source/`
- `themes/fett/`

When npm is available, install and build with:

```bash
npm install
npm run build
```

Blog content lives in `source/_posts/*.md`. Put post metadata in front matter so Hexo can generate homepage cards, tags, categories, recent posts, and article pages through the `fett` theme.
