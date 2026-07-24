/* ===== 学生作品展示馆 · 共享后端（纯 Node，零依赖，含老师权限 + GitHub 持久化） =====
 * 双入口：
 *   1) 本地：node server.js  -> 启动 HTTP 服务（默认 :3000）
 *   2) 阿里云 FC 内置 Node.js 运行时：exports.handler（HTTP 触发器，handler=server.handler）
 * 两者共用同一套路由与 GitHub 持久化逻辑，无需 Docker、无需打包运行时。
 */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

/* 带超时的 fetch：GitHub 不通时不能无限挂起，否则会拖垮请求/初始化 */
async function fetchWithTimeout(url, opts, ms = 5000){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

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
console.log('✅ server.js 模块加载完成（数据目录:', ROOT, '）');

/* ---------- 工具 ---------- */
function uid(){ return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function readWorks(){ try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){ return []; } }
function writeWorksLocal(list){ fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2)); }
function isAdmin(reqMeta){ return reqMeta.headers['x-admin-token'] === ADMIN_TOKEN; }

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
  const r = await fetchWithTimeout(`https://api.github.com/repos/${GH_REPO}/contents/${encodeURI(p)}?ref=${GH_BRANCH}`, { headers: ghHeaders() });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error('GH GET ' + p + ' -> ' + r.status);
  return r.json();
}
async function ghPut(p, b64, message, sha){
  const body = { message, content: b64, branch: GH_BRANCH };
  if(sha) body.sha = sha;
  const r = await fetchWithTimeout(`https://api.github.com/repos/${GH_REPO}/contents/${encodeURI(p)}`, {
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
/* 启动时 GitHub 同步（仅本地模式使用；FC 模式下 zip 已含全部数据，不需要同步）。
   此函数永不阻塞 handler——FC handler 不调用此函数。 */
async function syncFromGitHub(){
  if(fs.existsSync(DATA_FILE) && fs.readdirSync(UPLOAD_DIR).length > 0){
    console.log('✅ 本地数据完整，跳过 GitHub 同步');
    return;
  }
  if(!USE_GH) return;
  try{
    const c = await ghGet('works.json');
    if(c){ writeWorksLocal(JSON.parse(Buffer.from(c.content, 'base64').toString('utf8'))); console.log('✅ 已从 GitHub 引导作品数据'); }
  }catch(e){ console.warn('⚠️ GitHub 引导失败，使用本地数据：', e.message); }
  try{
    const list = readWorks();
    for(const w of list){
      if(w.image && w.image.startsWith('uploads/')){
        const fp = path.join(UPLOAD_DIR, path.basename(w.image));
        if(!fs.existsSync(fp)){
          try{ const img = await ghGet(w.image); if(img) fs.writeFileSync(fp, Buffer.from(img.content, 'base64')); }
          catch(e){ console.warn('⚠️ 拉取封面失败：', w.image); }
        }
      }
    }
  }catch(e){}
}

/* FC 模式下不触发任何启动同步（zip 包已含全部数据，handler 直接服务请求） */
const ready = isFcEnv() ? Promise.resolve() : syncFromGitHub();

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.webp':'image/webp'
};

/* 返回 Promise，确保 FC 异步响应在 handler 返回前已发送 */
function sendFile(res, filePath){
  return new Promise((resolve) => {
    fs.readFile(filePath, (err, data) => {
      if(err){ res.writeHead(404); res.end('Not found'); }
      else {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      }
      resolve();
    });
  });
}

/* 把请求体 Buffer 解析为 JSON（替代原来的流式中转） */
function parseJsonBody(buf, limit){
  return new Promise((resolve, reject) => {
    if(buf && buf.length > limit){ return reject(new Error('too large')); }
    try{ resolve(JSON.parse((buf || Buffer.alloc(0)).toString('utf8'))); }catch(e){ reject(e); }
  });
}

function json(res, code, obj, cors){
  const headers = { 'Content-Type':'application/json' };
  if(cors) headers['Access-Control-Allow-Origin'] = '*';
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

/* ---------- API ---------- */
async function handleApi(reqMeta, res, pathname){
  const cors = true;
  try{
    if(reqMeta.method === 'OPTIONS'){
      res.writeHead(204, {
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET,POST,DELETE',
        'Access-Control-Allow-Headers':'Content-Type, x-admin-token'
      });
      return res.end();
    }

    /* 老师登录：口令正确则发放管理令牌 */
    if(reqMeta.method === 'POST' && pathname === '/api/login'){
      const body = await parseJsonBody(reqMeta.body, 1024);
      const pw = (body.password || '').toString();
      if(pw === ADMIN_PASSWORD) return json(res, 200, { ok:true, token: ADMIN_TOKEN }, cors);
      return json(res, 401, { error:'口令错误' }, cors);
    }

    /* 读取作品：所有人可看 */
    if(reqMeta.method === 'GET' && pathname === '/api/works'){
      return json(res, 200, readWorks(), cors);
    }

    /* 发布作品：仅老师可操作 */
    if(reqMeta.method === 'POST' && pathname === '/api/works'){
      if(!isAdmin(reqMeta)) return json(res, 401, { error:'需要老师口令才能发布' }, cors);
      const body = await parseJsonBody(reqMeta.body, 12 * 1024 * 1024);
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
    if(reqMeta.method === 'DELETE' && pathname.startsWith('/api/works/')){
      if(!isAdmin(reqMeta)) return json(res, 401, { error:'需要老师口令才能删除' }, cors);
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

/* ---------- 路由核心（本地 / FC 共用）---------- */
async function route(reqMeta, res, rawUrl){
  const url = new URL(rawUrl, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if(pathname.startsWith('/api/')) return handleApi(reqMeta, res, pathname);

  if(pathname.startsWith('/uploads/')){
    const fp = path.normalize(path.join(UPLOAD_DIR, path.basename(pathname)));
    if(!fp.startsWith(UPLOAD_DIR)){ res.writeHead(403); return res.end('forbidden'); }
    return sendFile(res, fp);
  }

  const rel = pathname === '/' ? '/index.html' : pathname;
  const fp = path.normalize(path.join(ROOT, rel));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('forbidden'); }
  return sendFile(res, fp);
}

/* ---------- 本地入口 ---------- */
function readNodeBody(req){
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if(n > 12*1024*1024){ req.destroy(); reject(new Error('too large')); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try{
    const buf = await readNodeBody(req);
    await route({ method: req.method, headers: req.headers, body: buf }, res, req.url);
  }catch(e){
    console.error('本地请求错误:', e);
    if(!res.headersSent){ res.writeHead(500); res.end('Internal Server Error'); }
  }
});

/* 判断是否运行在阿里云 FC 环境中（多种指标综合判断，不依赖单一变量） */
function isFcEnv(){
  return !!(process.env.FC_FUNCTION_NAME || process.env.FC_FUNCTION_HANDLER ||
           process.env.ALIYUN_FC || process.env.FC_RUNTIME ||
           process.env.FC_ACCOUNT_ID);
}

/* 本地模式：启动 HTTP 服务。FC 环境下不启动监听（由 exports.handler 处理请求）。 */
if(!isFcEnv()){
  (async () => {
    await ready;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ 学生作品展示馆已启动： http://localhost:${PORT}  （老师默认口令：teacher123）`);
      console.log(USE_GH ? ('🔗 已启用 GitHub 持久化：' + GH_REPO) : '⚠️ 未配置 GITHUB_TOKEN，使用本地文件（redeploy 会丢失新增作品）');
    });
  })();
} else {
  console.log('✅ 检测到 FC 环境，跳过本地 HTTP 服务启动');
}

/* ---------- 阿里云 FC 入口（内置 Node.js 运行时，HTTP 触发器）---------- */
function buildQuery(q){
  if(!q || typeof q !== 'object') return '';
  const parts = [];
  for(const k in q){ const v = q[k]; const arr = Array.isArray(v) ? v : [v]; arr.forEach(x => parts.push(k + '=' + encodeURIComponent(x))); }
  return parts.length ? ('?' + parts.join('&')) : '';
}
/* 把 FC 的 resp 适配成 route() 需要的接口（writeHead/end/setHeader/headersSent） */
function makeFcRes(resp){
  let code = 200; const hdrs = {};
  const adapter = {
    get headersSent(){ try { return resp.hasSent ? resp.hasSent() : false; } catch(e){ return false; } },
    writeHead(c, headers){ code = c; if(headers) Object.assign(hdrs, headers); return adapter; },
    setHeader(k, v){ hdrs[k] = v; return adapter; },
    end(body){ try{ resp.setStatusCode(code); }catch(e){} for(const k in hdrs){ try{ resp.setHeader(k, hdrs[k]); }catch(e){} } if(body === undefined) resp.send(''); else resp.send(body); },
    destroy(){}
  };
  return adapter;
}
exports.handler = async (req, resp, context) => {
  console.log('🔔 FC handler 被调用，开始处理请求...');
  /* 必须是 Web 函数（HTTP 模式）才会拿到真正的 HTTP 响应对象。
     事件函数下 resp 是 context，调用 resp.send 必然失败 -> 浏览器 ERR_INVALID_RESPONSE。 */
  const isWeb = resp && typeof resp.setStatusCode === 'function';
  if(!isWeb){
    console.error('⚠️ 当前不是「Web 函数」模式：handler 未收到 HTTP 响应对象。请在函数计算创建函数时选择「Web 函数」（而非事件函数）并配置 HTTP 触发器。');
    const errMsg = '请在阿里云函数计算控制台中：删除当前函数 → 使用「内置运行时」重新创建 → 函数类型选「Web 函数」→ 运行环境 Node.js 20 → 请求处理程序填 server.handler';
    try{
      if(context && typeof context.callback === 'function'){
        context.callback(null, { statusCode: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: errMsg });
      }
      return;
    }catch(e){
      console.error('callback 也失败:', e.message);
      return;
    }
  }
  try{
    const method = (req.method || 'GET').toUpperCase();
    const headers = req.headers || {};
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const rawPath = req.path || (req.url ? String(req.url).split('?')[0] : '/');
    const rawUrl = rawPath + buildQuery(req.queries);
    console.log('🔔 路由分发:', method, rawUrl);
    await route({ method, headers, body }, makeFcRes(resp), rawUrl);
    console.log('🔔 请求处理完成');
  }catch(e){
    console.error('FC 请求错误:', e);
    try{ if(!resp.hasSent || !resp.hasSent()){ resp.setStatusCode(500); resp.setHeader('Content-Type','text/plain; charset=utf-8'); resp.send('Internal Server Error: ' + e.message); } }catch(_){}
  }
};
