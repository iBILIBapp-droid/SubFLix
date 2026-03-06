# Subflix Reverse Proxy — Setup Guide

Pick **Option A** (Node.js) or **Option B** (Nginx) depending on your server.

---

## Option A — Node.js (Recommended for beginners)

### Requirements
- Node.js 18+ installed on your server

### Steps

1. **Upload these files to your server:**
   ```
   server.js
   package.json
   subflix.js      → place inside a folder called  public/
   subflix.css     → place inside  public/
   subflix.html    → place inside  public/
   ```
   Final structure:
   ```
   subflix-proxy/
   ├── server.js
   ├── package.json
   └── public/
       ├── subflix.html
       ├── subflix.css
       └── subflix.js
   ```

2. **Install dependencies:**
   ```bash
   cd subflix-proxy
   npm install
   ```

3. **Start the server:**
   ```bash
   node server.js
   ```
   Visit `http://localhost:3000` — done.

4. **Run in production (keep alive):**
   ```bash
   npm install -g pm2
   pm2 start server.js --name subflix
   pm2 save
   pm2 startup
   ```

5. **Custom port:**
   ```bash
   PORT=8080 node server.js
   ```

---

## Option B — Nginx

### Requirements
- Nginx with `ngx_http_sub_module` (included by default on most distros)

### Steps

1. **Upload your front-end files:**
   ```bash
   sudo mkdir -p /var/www/subflix
   # copy subflix.html, subflix.css, subflix.js there
   ```

2. **Install the config:**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/subflix
   sudo ln -s /etc/nginx/sites-available/subflix /etc/nginx/sites-enabled/
   ```

3. **Edit the config** — open `nginx.conf` and change:
   - `server_name yourdomain.com;` → your actual domain
   - `root /var/www/subflix;` → where you put the files

4. **Test & reload:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## How it works

```
Browser (your user)
   │
   │  loads subflix.html from YOUR server
   │
   ▼
Your Server  (Node.js or Nginx)
   │
   │  /proxy/en/netflix  →  fetches from onoflix.live/en/netflix
   │  rewrites HTML:
   │    • onoflix  →  Subflix
   │    • removes Discord / Telegram links
   │    • removes back-navigation buttons
   │    • strips X-Frame-Options header
   │    • rewrites internal links to stay in proxy
   │
   ▼
Browser receives rebranded page — same origin — iframe patching works fully
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on start | Check Node version: `node -v` (need 18+) |
| Styles missing in proxied page | Some CSS uses absolute URLs — check browser console |
| Videos not playing | The proxy only rewrites HTML; video streams (HLS/DASH) load directly from onoflix CDN, which is fine |
| Page loops / redirects | Check `proxy_redirect` rules in nginx.conf or the `pathRewrite` in server.js |
| Port 3000 blocked | Change `PORT=` env var or open port in firewall: `sudo ufw allow 3000` |
