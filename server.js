/* ===== 学生作品展示馆 · 共享后端（纯 Node，零依赖，含老师权限） ===== */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT       = __dirname;
const DATA_DIR   = path.join(ROOT, 'data');
const DATA_FILE  = path.join(DATA_DIR, 'works.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT       = process.env.PORT || 3000;

/* 老师口令：可用环境变量覆盖，例如 ADMIN_PASSWORD=xxxx node server.js */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'teacher123';
/* 启动后随机生成的管理令牌；老师用口令登录换取，重启后失效需重新登录 */
const ADMIN_TOKEN = crypto.randomBytes(16).toString('hex');

fs.mkdirSync(DATA_DIR,   { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if(!fs.existsSync(DATA_FILE)){
  const seed = [
    { id:uid(), title:'《零食大冒险》',       domain:'https://c63gg3djimd.coze.site/',     author:'小招',        school:'XXXX',          teacher:'XXX',         image:null, color:'#6366f1', createdAt:Date.now() },
    { id:uid(), title:'《前线机甲》',         domain:'https://mvvvqbszye.coze.site',      author:'蒙洋',        school:'成外美年',      teacher:'张德胜',      image:null, color:'#10b981', createdAt:Date.now() },
    { id:uid(), title:'《寻找手机》',         domain:'https://vxfn8hy6jw.coze.site/',     author:'周禹豪',      school:'益州小学',      teacher:'张德胜',      image:null, color:'#fb7185', createdAt:Date.now() },
    { id:uid(), title:'《作业大作战》',       domain:'https://dmp37yvwkck.coze.site/',   author:'付倚山',      school:'蒙彼利埃小学',  teacher:'张德胜',      image:null, color:'#f59e0b', createdAt:Date.now() },
    { id:uid(), title:'《The Land of Holalu》',domain:'https://bt7yj58jk4.coze.site/',   author:'廖敏焯',      school:'成都霍森斯小学',teacher:'张德胜',      image:null, color:'#8b5cf6', createdAt:Date.now() },
    { id:uid(), title:'《炸房子》',           domain:'https://gn53pgbzn7.coze.site',     author:'廖睿哲',      school:'天府七小',      teacher:'张德胜',      image:null, color:'#06b6d4', createdAt:Date.now() },
    { id:uid(), title:'家庭保卫战',           domain:'https://kvzhq5sccg.coze.site',     author:'余承衡',      school:'圣菲小学',      teacher:'文浩',         image:null, color:'#ec4899', createdAt:Date.now() },
    { id:uid(), title:'作业大作战',           domain:'https://qvyzvzd3rbr.coze.site',    author:'苏奕诚',      school:'成外美年',      teacher:'文浩',         image:null, color:'#14b8a6', createdAt:Date.now() },
    { id:uid(), title:'作业保卫战',           domain:'https://rsnvqvjspn.coze.site',    author:'钟予辰',      school:'泡小天府',      teacher:'文浩',         image:null, color:'#f97316', createdAt:Date.now() },
    { id:uid(), title:'大战爸妈',             domain:'https://3cek5gqxj6.coze.site',     author:'李佑鹿',      school:'成外美年',      teacher:'文浩',         image:null, color:'#a855f7', createdAt:Date.now() },
    { id:uid(), title:'机械皇帝的密令',       domain:'https://7bm2g7bjvj.coze.site/',    author:'罗爱文',      school:'成外美年',      teacher:'文浩',         image:null, color:'#22c55e', createdAt:Date.now() },
    { id:uid(), title:'神秘的家庭',           domain:'https://ssybdc7xgb.coze.site',    author:'王敏行',      school:'蒙彼利埃小学',  teacher:'文浩',         image:null, color:'#ef4444', createdAt:Date.now() },
    { id:uid(), title:'神秘的家庭',           domain:'https://ps5q32z27c.coze.site',    author:'林文彩',      school:'泡小天府',      teacher:'文浩',         image:null, color:'#0ea5e9', createdAt:Date.now() },
    { id:uid(), title:'《我要回家！》',       domain:'https://rqh52gz7mf.coze.site',    author:'Jamie',       school:'九小',          teacher:'周小梅',      image:null, color:'#eab308', createdAt:Date.now() },
    { id:uid(), title:'《家庭寻宝大冒险》',   domain:'https://wjysvvsmn6.coze.site/',   author:'冯睿之',      school:'无',            teacher:'周小梅',      image:null, color:'#84cc16', createdAt:Date.now() },
    { id:uid(), title:'《王牌突击队》',       domain:'https://bgs5zzg6vv.coze.site',    author:'黄泽睿',      school:'无',            teacher:'周小梅',      image:null, color:'#f43f5e', createdAt:Date.now() },
    { id:uid(), title:'《心屿大冒险》',       domain:'https://mtydfb5rsr.coze.site',    author:'景钰涵',      school:'无',            teacher:'周小梅',      image:null, color:'#6366f1', createdAt:Date.now() },
    { id:uid(), title:'《逃出大楼》',         domain:'https://nmnd6ntg7p.coze.site',    author:'宋宜宸',      school:'无',            teacher:'周小梅',      image:null, color:'#10b981', createdAt:Date.now() },
    { id:uid(), title:'《无名》',             domain:'https://wd9v6yscj2.coze.site',    author:'马浩天',      school:'无',            teacher:'周小梅',      image:null, color:'#fb7185', createdAt:Date.now() },
    { id:uid(), title:'《洪荒之刃》',         domain:'https://4b5rdrbrh6h.coze.site',   author:'何远墨',      school:'天府四小',      teacher:'符洙染',      image:null, color:'#f59e0b', createdAt:Date.now() },
    { id:uid(), title:'《Dino Jump》',        domain:'https://mr89mm3j6y.coze.site',    author:'王承天',      school:'天府三小',      teacher:'符洙染',      image:null, color:'#8b5cf6', createdAt:Date.now() },
    { id:uid(), title:'《火柴人亨利》',       domain:'https://bw2ccqpjjk.coze.site',    author:'周泽希',      school:'天府三小',      teacher:'符洙染',      image:null, color:'#06b6d4', createdAt:Date.now() },
    { id:uid(), title:'午夜时刻',             domain:'https://btwc5njrnv.coze.site',    author:'罗析',        school:'圣菲学校',      teacher:'符洙染',      image:null, color:'#ec4899', createdAt:Date.now() },
    { id:uid(), title:'断电密窍',             domain:'https://sxrmfbb8f9j.coze.site/',  author:'李程熙',      school:'无',            teacher:'黄倩',         image:null, color:'#14b8a6', createdAt:Date.now() },
  ];
  fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}

/* ---------- 工具 ---------- */
function uid(){ return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function readWorks(){ try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){ return []; } }
function writeWorks(list){ fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2)); }
function isAdmin(req){ return req.headers['x-admin-token'] === ADMIN_TOKEN; }

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
function handleApi(req, res, pathname){
  const cors = true;
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
    return readJson(req, 1024).then(body => {
      const pw = (body.password || '').toString();
      if(pw === ADMIN_PASSWORD) return json(res, 200, { ok:true, token: ADMIN_TOKEN }, cors);
      return json(res, 401, { error:'口令错误' }, cors);
    }).catch(() => json(res, 400, { error:'请求错误' }, cors));
  }

  /* 读取作品：所有人可看 */
  if(req.method === 'GET' && pathname === '/api/works'){
    return json(res, 200, readWorks(), cors);
  }

  /* 发布作品：仅老师可操作 */
  if(req.method === 'POST' && pathname === '/api/works'){
    if(!isAdmin(req)) return json(res, 401, { error:'需要老师口令才能发布' }, cors);
    return readJson(req, 12 * 1024 * 1024).then(body => {
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
          try{
            const fname = uid() + '.' + ext;
            fs.writeFileSync(path.join(UPLOAD_DIR, fname), Buffer.from(m[2], 'base64'));
            imageUrl = '/uploads/' + fname;
          }catch(e){ console.error('图片保存失败', e); }
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
      writeWorks(list);
      return json(res, 201, work, cors);
    }).catch(() => json(res, 400, { error:'请求体解析失败' }, cors));
  }

  /* 删除作品：仅老师可操作 */
  if(req.method === 'DELETE' && pathname.startsWith('/api/works/')){
    if(!isAdmin(req)) return json(res, 401, { error:'需要老师口令才能删除' }, cors);
    const id = pathname.split('/').pop();
    const list = readWorks();
    const idx = list.findIndex(w => w.id === id);
    if(idx === -1) return json(res, 404, { error:'未找到该作品' }, cors);
    const [removed] = list.splice(idx, 1);
    writeWorks(list);
    if(removed && removed.image && removed.image.startsWith('/uploads/')){
      try{ fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(removed.image))); }catch(e){}
    }
    return json(res, 200, { ok:true }, cors);
  }

  return json(res, 404, { error:'接口不存在' }, cors);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 学生作品展示馆已启动： http://localhost:${PORT}  （老师默认口令：teacher123）`);
});
