// Generates the local social card from the game's own canvas illustration.
// Run after npm run build. Requires an external Playwright installation.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
const { chromium } = await import(process.env.IMD_PLAYWRIGHT || 'playwright');
const root = resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = createServer(async (req,res) => {
  try {
    const path = resolve(root, req.url === '/' ? 'index.html' : '.' + req.url);
    if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0,'127.0.0.1',done));
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1200,height:630},reducedMotion:'reduce',deviceScaleFactor:1});
  await page.route('https://**',r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'.site-header,.below-game,footer,.skip-link,.hamster-status,.idle-best{display:none!important}.game-scene{height:630px;min-height:630px}.intro{left:6%;top:74px}h1{font-size:72px}.tagline{margin-top:20px}.community-note{margin-top:24px}'});
  await page.waitForTimeout(150);
  await page.screenshot({path:'public/share.png'});
  console.log('Generated public/share.png, 1200 × 630, from the actual game scene. Rebuild to copy it into dist/.');
} finally { await browser.close(); server.close(); }
