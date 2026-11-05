// Production-export interaction validation. All score submissions are intercepted.
// Playwright is supplied externally; this is never bundled into the game.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const { chromium, webkit } = await import(process.env.IMD_PLAYWRIGHT || 'playwright');
const scratch = resolve('test/scratch/browser');
await mkdir(scratch, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.txt':'text/plain' };
const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/preview\//, '');
    const full = resolve(root, path === '' ? 'index.html' : path);
    if (!full.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[extname(full)] || 'application/octet-stream');
    res.end(await readFile(full));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const errors = [];
const check = (name, detail = '') => { results.push({ name, passed:true, detail }); console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`); };
const contrastResults = [];
async function checkContrast(page, state) {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    const box = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const parse = s => (s.match(/[\d.]+/g)||[]).map(Number);
    const lum = c => c.slice(0,3).map(v => {v/=255;return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const readings = [];
    for (const el of document.querySelectorAll('h1,h1>span,.tagline,.community-note,.play-hint,.hamster-status,#score,.run-meta>span,#live-bonus,.result-panel h2,.result-subtitle,.final-score,.result-stats span,.result-stats strong,.claim-form label,.field-hint,.claim-message,.leaderboard h2,.runner,.runner-score,.runner-time,.board-caption,.field-guide h2,.field-guide>p,footer>span,.primary-button,.secondary-button')) {
      if (!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}) || !el.textContent.trim() || el.disabled) continue;
      const r = el.getBoundingClientRect(), style = getComputedStyle(el), fg = parse(style.color);
      if (r.width < 1 || r.height < 1) continue;
      let solid = null;
      for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const bg = parse(getComputedStyle(p).backgroundColor); if (bg.length === 3 || bg[3] === 1) { solid = bg; break; } }
      let minimum = Infinity;
      for (const sx of [.2,.5,.8]) for (const sy of [.25,.5,.75]) {
        const x=r.left+r.width*sx, y=r.top+r.height*sy;
        let background = solid;
        if (!background && x>=box.left && x<box.right && y>=box.top && y<box.bottom) background=[...ctx.getImageData(Math.floor((x-box.left)*canvas.width/box.width),Math.floor((y-box.top)*canvas.height/box.height),1,1).data];
        background ??= parse(getComputedStyle(document.documentElement).backgroundColor);
        minimum = Math.min(minimum,ratio(fg,background));
      }
      const large = parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700);
      readings.push({text:el.textContent.trim().slice(0,55),minimum:Number(minimum.toFixed(2)),threshold:large?3:4.5,passed:minimum >= (large?3:4.5)});
    }
    return readings;
  });
  contrastResults.push({state,readings:result});
  assert.deepEqual(result.filter(r=>!r.passed),[],`Text contrast in ${state}`);
  check(`sampled rendered contrast: ${state}`,`${result.length} visible text elements, including actual canvas underlays`);
}
const fixtures = [{name:'AcornRunner',score:37451,secs:94},{name:'TinyPaws',score:12430,secs:51},{name:'SeedBandit',score:6520,secs:35},{name:'Wheelie',score:4000,secs:29},{name:'NightHamster',score:2350,secs:21}];
const browser = await chromium.launch({ headless:true });
let browser2;
try {
  const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  let statusCalls = 0, claimCalls = 0, topCalls = 0;
  let status = { measurement:{freshness:'online',rpmMilli:0} };
  let statusFailure = false;
  let boardFailure = false;
  let boardRows = [...fixtures];
  let submitMode = 'slow_down';
  let lastClaim;
  await page.route('https://api.squeekchain.com/**', async route => {
    statusCalls++;
    if (statusFailure) { await route.abort(); return; }
    await route.fulfill({json:status,headers:{'access-control-allow-origin':'*'}});
  });
  await page.route('https://baugveuujnzqsuehfrxz.supabase.co/**', async route => {
    const request = route.request();
    assert.equal(request.headers().apikey, 'sb_publishable_WruR0oYAecH4If6PT9uj2A_YOsjdQZP');
    assert.equal(request.headers().authorization, undefined);
    assert.ok(!request.url().includes('sb_publishable'));
    assert.equal(request.method(), 'POST');
    if (request.url().endsWith('/top_scores')) {
      topCalls++;
      assert.deepEqual(request.postDataJSON(), {n:20});
      if (boardFailure) await route.fulfill({status:503,json:{message:'unavailable'}});
      else await route.fulfill({json:boardRows});
    } else if (request.url().endsWith('/submit_score')) {
      claimCalls++; lastClaim = request.postDataJSON();
      await new Promise(done=>setTimeout(done,200));
      assert.ok(Number.isSafeInteger(lastClaim.p_score) && lastClaim.p_score >= 0);
      assert.ok(Number.isSafeInteger(lastClaim.p_secs) && lastClaim.p_secs >= 0);
      assert.ok(lastClaim.p_name.length <= 14);
      if (submitMode === 'success') {
        boardRows = [...fixtures, {name:lastClaim.p_name,score:lastClaim.p_score,secs:lastClaim.p_secs}];
        await route.fulfill({json:{rank:6,name:lastClaim.p_name}});
      } else if (submitMode === 'network') await route.abort();
      else await route.fulfill({status:400,json:{message:submitMode}});
    } else throw new Error('Unexpected Supabase endpoint');
  });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#leaderboard-list li').first().waitFor();
  assert.equal(await page.title(), 'Squeek Wheel Rush | Tiny paws. Big scores.');
  assert.equal(await page.locator('#leaderboard-list li').count(), 5);
  const start = await page.locator('#start-button').boundingBox();
  assert.ok(start.y + start.height <= 844);
  check('390px start screen shows the game and Start running; real DOM leaderboard rendering');
  await page.screenshot({path:`${scratch}/start-390.png`,fullPage:true});
  await checkContrast(page,'start 390');

  await page.locator('#help-button').click();
  assert.equal(await page.locator('#help-dialog').evaluate(d => d.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#help-dialog').evaluate(d => d.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'help-button');
  check('native help dialog, Escape close, and focus restoration');

  await page.locator('#start-button').click();
  assert.equal(await page.locator('body').getAttribute('data-state'), 'running');
  assert.equal(await page.locator('#hamster-status-text').textContent(), 'Squeektoshi is active');
  await page.keyboard.down('Space');
  await page.waitForTimeout(330);
  await page.screenshot({path:`${scratch}/jump-390.png`});
  await checkContrast(page,'running 390');
  await page.keyboard.up('Space');
  await page.waitForTimeout(650);
  const jumpControl = await page.locator('#jump-button').boundingBox();
  await page.mouse.move(jumpControl.x+jumpControl.width/2,jumpControl.y+jumpControl.height/2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.screenshot({path:`${scratch}/touch-control-390.png`});
  await page.mouse.up();
  check('the visible phone jump control supports a held pointer press');
  await page.keyboard.press('KeyM');
  assert.equal(await page.locator('#mute-button').getAttribute('aria-pressed'), 'true');
  await page.locator('#mute-button').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#mute-button').getAttribute('aria-pressed'), 'false');
  check('keyboard jump, M mute shortcut, and Space still activates focused utility buttons');

  await page.locator('#pause-button').click();
  const frozen = await page.locator('#score').textContent();
  await page.waitForTimeout(1050);
  assert.equal(await page.locator('#score').textContent(), frozen);
  assert.equal(await page.locator('body').getAttribute('data-state'), 'paused');
  await page.screenshot({path:`${scratch}/paused-390.png`});
  await page.locator('#resume-button').click();
  check('pause freezes score, and resume continues the same run');

  await page.locator('#game-over').waitFor({state:'visible',timeout:12000});
  assert.ok(Number((await page.locator('#final-score').textContent()).replaceAll(',','')) > 0);
  assert.equal(await page.locator('#hamster-status-text').textContent(), 'Squeektoshi is asleep');
  assert.ok(await page.locator('#result-title').textContent() === 'New best!');
  await page.locator('#claim-button').click();
  assert.equal(await page.locator('#runner-name').getAttribute('aria-invalid'), 'true');
  assert.equal(claimCalls, 0);
  await page.locator('#runner-name').fill('SqueekTester');
  await page.locator('#claim-button').click();
  assert.equal(await page.locator('#claim-button').isDisabled(),true);
  assert.equal(await page.locator('#claim-button').textContent(),'Claiming…');
  await page.locator('#claim-message').filter({hasText:'Wait a few seconds'}).waitFor();
  assert.equal(await page.locator('#claim-button').isDisabled(), true);
  await page.waitForFunction(() => !document.querySelector('#claim-button').disabled, {timeout:7000});
  check('unattended peg collision, tumble/results, best score, name validation, and slow_down retry cooldown');

  submitMode = 'network';
  await page.locator('#claim-button').click();
  await page.locator('#claim-message').filter({hasText:'Check your connection'}).waitFor();
  assert.equal(await page.locator('#claim-button').isEnabled(), true);
  submitMode = 'success';
  await page.locator('#claim-button').click();
  await page.locator('#claim-message').filter({hasText:"Claimed. You're #6 in the world."}).waitFor();
  await page.locator('.own-score').waitFor();
  assert.equal(await page.locator('.own-score .runner').textContent(), 'SqueekTester');
  assert.equal(await page.locator('#claim-button').isDisabled(), true);
  assert.equal(await page.locator('#runner-name').isDisabled(), true);
  assert.equal(lastClaim.p_name,'SqueekTester');
  await page.screenshot({path:`${scratch}/claimed-390.png`,fullPage:true});
  await checkContrast(page,'claimed 390');
  check('claim network failure is retryable; successful claim uses exact RPC body and highlights returned runner');

  await page.locator('#again-button').click();
  status = {measurement:{freshness:'online',rpmMilli:16000}};
  await page.locator('#live-bonus').waitFor({state:'visible',timeout:5000});
  await page.touchscreen.tap(100, 450);
  await page.locator('#game-over').waitFor({state:'visible',timeout:12000});
  assert.ok(statusCalls >= 3);
  submitMode = 'bad_score';
  await page.locator('#claim-button').click();
  await page.locator('#claim-message').filter({hasText:'This run was rejected'}).waitFor();
  assert.equal(await page.locator('#claim-button').isDisabled(), true);
  check('touch canvas jump, three-second status polling, live bonus note, and bad_score rejection');

  await page.locator('#again-button').click();
  statusFailure = true;
  await page.waitForTimeout(3100);
  assert.equal(await page.locator('#live-bonus').isHidden(), true);
  await page.locator('#game-over').waitFor({state:'visible',timeout:12000});
  submitMode = 'bad_time';
  await page.locator('#claim-button').click();
  await page.locator('#claim-message').filter({hasText:'This run was rejected'}).waitFor();
  check('status failure removes the bonus without blocking play; bad_time run is rejected clearly');

  await page.locator('#home-button').click();
  boardFailure = true;
  await page.locator('#refresh-button').click();
  await page.locator('#leaderboard-state').filter({hasText:'Showing the last loaded scores'}).waitFor();
  assert.ok(await page.locator('#leaderboard-list li').count() > 0);
  boardFailure = false;
  await page.getByRole('button',{name:'Retry leaderboard',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#leaderboard-state').hidden);
  check('leaderboard refresh error retains known scores and supports retry');

  await page.reload();
  assert.equal(await page.locator('#runner-name').inputValue(),'SqueekTester');
  assert.ok(Number((await page.locator('#personal-best').textContent()).replaceAll(',','')) > 0);
  await page.keyboard.press('Tab');
  await page.screenshot({path:`${scratch}/focus-390.png`});
  check('personal best and runner name persist on this device');

  // Deterministic reduced-motion image comparison: decorative scene must be still.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(100);
  const firstCanvas = await page.locator('#game-canvas').screenshot();
  await page.waitForTimeout(300);
  const secondCanvas = await page.locator('#game-canvas').screenshot();
  assert.ok(firstCanvas.equals(secondCanvas));
  check('reduced motion freezes all decorative canvas motion on the start screen');

  for (const [width,height] of [[320,740],[390,664],[760,800],[900,700],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(80);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    if (width===390 && height===664) { const box=await page.locator('#start-button').boundingBox(); assert.ok(box.y+box.height < height); }
    await page.screenshot({path:`${scratch}/layout-${width}-${height}.png`,fullPage:true});
  }
  check('no horizontal overflow at 320, 390, 760, 900, 1440, 1920; Start running visible at 390×664');

  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#start-button').click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.screenshot({path:`${scratch}/running-1440.png`});
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('body').getAttribute('data-state'), 'running');
  await page.keyboard.press('ArrowUp');
  check('desktop W/Up controls and Escape pause/resume');
  await page.locator('#game-over').waitFor({state:'visible',timeout:12000});
  await page.screenshot({path:`${scratch}/result-1440.png`,fullPage:true});
  await checkContrast(page,'results 1440');
  assert.deepEqual(errors,[]);
  check('production export works under /preview/ with no JavaScript errors');

  await page.locator('#home-button').click();
  boardRows = [{name:'WWWWWWWWWWWWWW',score:Number.MAX_SAFE_INTEGER,secs:99999},...fixtures];
  await page.locator('#refresh-button').click();
  await page.locator('.runner').filter({hasText:'WWWWWWWWWWWWWW'}).waitFor();
  await page.setViewportSize({width:320,height:740});
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  await page.screenshot({path:`${scratch}/long-values-320.png`,fullPage:true});
  check('14 wide characters and maximum safe integer scores remain complete and do not overflow at 320px');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  const disclaimerEnd=await page.locator('.community-note').evaluate(e=>e.getBoundingClientRect().bottom);
  const boardStart=await page.locator('#leaderboard-title').evaluate(e=>e.getBoundingClientRect().top);
  assert.ok(disclaimerEnd<boardStart);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#leaderboard-list li')].every(row=>row.querySelector('.runner-time').getBoundingClientRect().right<row.querySelector('.runner-score').getBoundingClientRect().left)));
  await page.screenshot({path:`${scratch}/text-200-percent-390.png`,fullPage:true});
  check('200% text enlargement reflows the start screen without horizontal overflow or a clipped main action');
  await page.evaluate(()=>document.documentElement.style.fontSize='');

  // A second context verifies no local storage and a genuinely empty/offline board.
  const blank = await browser.newContext({viewport:{width:320,height:740}});
  const empty = await blank.newPage();
  await empty.route('https://api.squeekchain.com/**',r=>r.abort());
  await empty.route('https://baugveuujnzqsuehfrxz.supabase.co/**',r=>r.fulfill({json:[]}));
  await empty.addInitScript(() => { Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Disabled','SecurityError');}}); });
  await empty.goto(url);
  await empty.locator('#leaderboard-state').filter({hasText:'Claim a run to be the first'}).waitFor();
  await empty.locator('#start-button').click();
  await empty.locator('#game-over').waitFor({state:'visible',timeout:12000});
  await empty.locator('#runner-name').fill('WWWWWWWWWWWWWW');
  assert.equal((await empty.locator('#runner-name').inputValue()).length,14);
  await empty.screenshot({path:`${scratch}/results-320.png`,fullPage:true});
  assert.ok(await empty.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  check('empty worldwide board is honest; blocked localStorage and unavailable status do not block a run');
  await blank.close();

  // Optional actual HTTP read, forwarded through curl because browser egress is restricted here.
  const actualContext = await browser.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
  const actual = await actualContext.newPage();
  const curl = promisify(execFile);
  let actualReadRows = null;
  await actual.route('https://api.squeekchain.com/v1/status', async route => {
    const {stdout} = await curl('curl',['-sS','--fail','--max-time','15','https://api.squeekchain.com/v1/status']);
    await route.fulfill({contentType:'application/json',body:stdout});
  });
  await actual.route('https://baugveuujnzqsuehfrxz.supabase.co/rest/v1/rpc/top_scores',async route=>{
    const {stdout} = await curl('curl',['-sS','--fail','--max-time','15','-H','apikey: sb_publishable_WruR0oYAecH4If6PT9uj2A_YOsjdQZP','-H','Content-Type: application/json','--data','{"n":20}','https://baugveuujnzqsuehfrxz.supabase.co/rest/v1/rpc/top_scores']);
    actualReadRows = JSON.parse(stdout);
    await route.fulfill({contentType:'application/json',body:stdout});
  });
  await actual.goto(url);
  await actual.locator('#leaderboard-list li').first().waitFor({timeout:20000});
  assert.equal(await actual.locator('#leaderboard-list li').count(),Math.min(actualReadRows.length,8));
  await actual.screenshot({path:`${scratch}/actual-endpoints-1440.png`,fullPage:true});
  check('actual public API responses render via read-only HTTP forwarding; no real scores submitted',`${actualReadRows.length} real rows`);
  await actualContext.close();

  try { browser2 = await webkit.launch({headless:true}); }
  catch { results.push({name:'WebKit',passed:null,detail:'Installed WebKit executable unavailable; no WebKit/physical iPhone behavior claimed.'}); }
  await context.close();
} catch (error) {
  results.push({name:'Interaction validation',passed:false,detail:String(error)});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (browser2) await browser2.close();
  server.close();
  await writeFile(`${scratch}/results.json`,JSON.stringify({results,errors},null,2));
  await writeFile(`${scratch}/contrast.json`,JSON.stringify(contrastResults,null,2));
}
