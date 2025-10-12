
# Music Discovery Hub — Static Site (Ad-Ready)

This is a static, SEO-friendly music portal designed to drive traffic and ad revenue. Upload the entire folder to your hosting (e.g., GitHub Pages, Nginx).

## Features
- Home + K-POP/J-POP/POP genre pages
- Release Calendar (client-side from JSON)
- Artists Index + Artist/Song detail pages
- Voting (localStorage) for engagement
- Ad placeholders: Top Leaderboard, In-Feed, In-Article, Anchor
- SEO: meta tags, Open Graph, robots.txt, sitemap.xml, rss.xml, ads.txt

## How to Deploy
1. Copy the `music_portal_static` contents to your web root.
2. Ensure your domain points to the host. For GitHub Pages, commit to the repository's root (or `/docs`) and enable Pages.
3. Replace sample data in `/data/*.json` with your real content.
4. Swap ad placeholders with your AdSense tags once approved.

## Customize
- Edit `/data/*.json` to add artists/songs/releases.
- Tweak styles in `/assets/css/style.css`.
- Add news links in `/news.html` (curated).

## Notes
- Lyrics should not be posted in full due to copyright; link to official sources.
- For dynamic/server features (ISR, programmatic pages), migrate to Next.js + Vercel later.
