/* ===== 学生作品展示馆 · 共享后端（纯 Node，零依赖，含老师权限 + GitHub 持久化） ===== */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT       = __dirname;
const DATA_FILE  = path.join(ROOT, 'works.json');   // 作品数据（仓库内置，含 24 件作品与封面）
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT       = process.env.PORT || 3000;

/* 老师口令：可用环境变量覆盖，例如 ADMIN_PASSWORD=xxxx node server.js */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'teacher123';
/* 启动后随机生成的管理令牌；老师用口令登录换取，重启后失效需重新登录 */
const ADMIN_TOKEN = crypto.randomBytes(16).toString('hex');

/* GitHub 持久化：把作品数据与封面图写回仓库，使 Render 等临时磁盘在 redeploy 时不丢数据，
   并让公开的 GitHub Pages 只读站自动同步更新。缺少令牌时自动降级为纯本地文件。 */
const GH_TOKEN   = process.env.GITHUB_TOKEN  || '';
const GH_REPO    = process.env.GITHUB_REPO   || 'summeriva/student-gallery';
const GH_BRANCH  = process.env.GITHUB_BRANCH || 'main';
const USE_GH     = !!GH_TOKEN;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- 工具 ---------- */
function uid(){ return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function readWorks(){ try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){ return []; } }
function writeWorksLocal(list){ fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2)); }
function isAdmin(req){ return req.headers['x-admin-token'] === ADMIN_TOKEN; }

/* ---------- GitHub 存储层 ---------- */
function ghHeaders(){
  return {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'student-gallery',
    'Content-Type': 'application/json'
  };
}
async function ghGet(p){
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${encodeURI(p)}?ref=${GH_BRANCH}`, { headers: ghHeaders() });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error('GH GET ' + p + ' -> ' + r.status);
  return r.json();
}
async function ghPut(p, b64, message, sha){
  const body = { message, content: b64, branch: GH_BRANCH };
  if(sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${encodeURI(p)}`, {
    method:'PUT', headers: ghHeaders(), body: JSON.stringify(body)
  });
  if(!r.ok) throw new Error('GH PUT ' + p + ' -> ' + r.status);
  return r.json();
}
/* 把最新作品列表写回仓库（best-effort，网络异常不阻断本地操作） */
async function pushWorks(list){
  if(!USE_GH) return;
  try{
    const cur = await ghGet('works.json');
    const sha = cur ? cur.sha : undefined;
    await ghPut('works.json', Buffer.from(JSON.stringify(list, null, 2)).toString('base64'), 'chore: update works via admin', sha);
  }catch(e){ console.error('⚠️ 推送 works.json 失败：', e.message); }
}
/* 把封面图写回仓库（best-effort）；失败则抛出由调用方降级为内联 data URL */
async function pushImage(fname, buf){
  const cur = await ghGet('uploads/' + fname);
  const sha = cur ? cur.sha : undefined;
  await ghPut('uploads/' + fname, buf.toString('base64'), 'add cover ' + fname, sha);
}
/* 启动时：本地数据缺失则从仓库引导；并补齐本地缺失的封面图（只读，不覆盖本地作品） */
async function syncFromGitHub(){
  if(!USE_GH) return;
  try{
    if(!fs.existsSync(DATA_FILE)){
      const c = await ghGet('works.json');
      if(c){ writeWorksLocal(JSON.parse(Buffer.from(c.content, 'base64').toString('utf8'))); console.log('✅ 已从 GitHub 引导作品数据'); }
    }
  }catch(e){ console.warn('⚠️ GitHub 引导失败，使用本地数据：', e.message); }
  try{
    const list = readWorks();
    for(const w of list){
      if(w.image && w.image.startsWith('uploads/')){
        const fp = path.join(UPLOAD_DIR, path.basename(w.image));
        if(!fs.existsSync(fp)){
          try{
            const img = await ghGet(w.image);
            if(img) fs.writeFileSync(fp, Buffer.from(img.content, 'base64'));
          }catch(e){ console.warn('⚠️ 拉取封面失败：', w.image); }
        }
      }
    }
  }catch(e){}
}

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.webp':'image/webp'
};

function sendFile(res, filePath){
  fs.readFile(filePath, (err, data) => {
    if(err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

function readJson(req, limit){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if(size > limit){ req.destroy(); reject(new Error('too large')); } else chunks.push(c); });
    req.on('end', () => { try{ resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }catch(e){ reject(e); } });
    req.on('error', reject);
  });
}

function json(res, code, obj, cors){
  const headers = { 'Content-Type':'application/json' };
  if(cors) headers['Access-Control-Allow-Origin'] = '*';
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

/* ---------- API ---------- */
async function handleApi(req, res, pathname){
  const cors = true;
  try{
    if(req.method === 'OPTIONS'){
      res.writeHead(204, {
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET,POST,DELETE',
        'Access-Control-Allow-Headers':'Content-Type, x-admin-token'
      });
      return res.end();
    }

    /* 老师登录：口令正确则发放管理令牌 */
    if(req.method === 'POST' && pathname === '/api/login'){
      const body = await readJson(req, 1024);
      const pw = (body.password || '').toString();
      if(pw === ADMIN_PASSWORD) return json(res, 200, { ok:true, token: ADMIN_TOKEN }, cors);
      return json(res, 401, { error:'口令错误' }, cors);
    }

    /* 读取作品：所有人可看 */
    if(req.method === 'GET' && pathname === '/api/works'){
      return json(res, 200, readWorks(), cors);
    }

    /* 发布作品：仅老师可操作 */
    if(req.method === 'POST' && pathname === '/api/works'){
      if(!isAdmin(req)) return json(res, 401, { error:'需要老师口令才能发布' }, cors);
      const body = await readJson(req, 12 * 1024 * 1024);
      const title  = (body.title  || '').toString().trim();
      const domain = (body.domain || '').toString().trim();
      const author = (body.author || '').toString().trim();
      if(!title || !domain) return json(res, 400, { error:'缺少作品名或游戏域名' }, cors);

      let imageUrl = null;
      const img = body.image;
      if(typeof img === 'string' && img.startsWith('data:')){
        const m = img.match(/^data:(image\/[a-z+]+);base64,(.*)$/i);
        if(m){
          const extMap = { 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg' };
          const ext = extMap[m[1]] || 'png';
          const buf = Buffer.from(m[2], 'base64');
          if(buf.length > 1024 * 1024){
            return json(res, 400, { error:'图片过大，请压缩到 1MB 以内' }, cors);
          }
          const fname = uid() + '.' + ext;
          const localFp = path.join(UPLOAD_DIR, fname);
          try{ fs.writeFileSync(localFp, buf); }catch(e){ console.error('本地图片保存失败', e); }
          imageUrl = 'uploads/' + fname;
          /* 同时写回 GitHub（失败则降级为内联 data URL，保证 redeploy 不丢） */
          if(USE_GH){
            try{ await pushImage(fname, buf); }
            catch(e){ console.error('GitHub 图片推送失败，改为内联存储：', e.message); imageUrl = img; }
          }
        }
      }

      const work = {
        id: uid(),
        title: title.slice(0, 80),
        domain: domain.slice(0, 500),
        author: author.slice(0, 60),
        image: imageUrl,
        color: ['#6366f1','#10b981','#fb7185','#f59e0b'][Math.floor(Math.random()*4)],
        createdAt: Date.now()
      };
      const list = readWorks();
      list.unshift(work);
      writeWorksLocal(list);
      await pushWorks(list);
      return json(res, 201, work, cors);
    }

    /* 删除作品：仅老师可操作 */
    if(req.method === 'DELETE' && pathname.startsWith('/api/works/')){
      if(!isAdmin(req)) return json(res, 401, { error:'需要老师口令才能删除' }, cors);
      const id = pathname.split('/').pop();
      const list = readWorks();
      const idx = list.findIndex(w => w.id === id);
      if(idx === -1) return json(res, 404, { error:'未找到该作品' }, cors);
      const [removed] = list.splice(idx, 1);
      writeWorksLocal(list);
      await pushWorks(list);
      if(removed && removed.image && removed.image.startsWith('uploads/')){
        try{ fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(removed.image))); }catch(e){}
      }
      return json(res, 200, { ok:true }, cors);
    }

    return json(res, 404, { error:'接口不存在' }, cors);
  }catch(err){
    console.error('API 错误:', err);
    if(!res.headersSent) json(res, 500, { error:'服务器内部错误' }, cors);
  }
}

/* ---------- 服务器 ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if(pathname.startsWith('/api/')) return handleApi(req, res, pathname);

  if(pathname.startsWith('/uploads/')){
    const fp = path.normalize(path.join(UPLOAD_DIR, path.basename(pathname)));
    if(!fp.startsWith(UPLOAD_DIR)){ res.writeHead(403); return res.end('forbidden'); }
    return sendFile(res, fp);
  }

  const rel = pathname === '/' ? '/index.html' : pathname;
  const fp = path.normalize(path.join(ROOT, rel));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('forbidden'); }
  return sendFile(res, fp);
});

(async () => {
  await syncFromGitHub();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 学生作品展示馆已启动： http://localhost:${PORT}  （老师默认口令：teacher123）`);
    console.log(USE_GH ? ('🔗 已启用 GitHub 持久化：' + GH_REPO) : '⚠️ 未配置 GITHUB_TOKEN，使用本地文件（redeploy 会丢失新增作品）');
  });
})();
