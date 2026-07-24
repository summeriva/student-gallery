/* ===== 批量生成游戏封面图（使用 sharp SVG→PNG） ===== */
const fs    = require('fs');
const path  = require('path');
const sharp = require('/Users/summer/.workbuddy/binaries/node/workspace/node_modules/sharp');

const ROOT       = __dirname;
const DATA_FILE  = path.join(ROOT, 'data', 'works.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const works = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const PALETTES = [
  { bg1:'#667eea', bg2:'#764ba2', accent:'#fbbf24' },
  { bg1:'#f093fb', bg2:'#f5576c', accent:'#fef08a' },
  { bg1:'#4facfe', bg2:'#00f2fe', accent:'#a7f3d0' },
  { bg1:'#43e97b', bg2:'#38f9d7', accent:'#fef08a' },
  { bg1:'#fa709a', bg2:'#fee140', accent:'#fff' },
  { bg1:'#a18cd1', bg2:'#fbc2eb', accent:'#fff' },
  { bg1:'#ff0844', bg2:'#ffb199', accent:'#fff' },
  { bg1:'#0c3483', bg2:'#6b8cce', accent:'#fbbf24' },
];

const GAME_ICONS = {
  '冒险':'🗺️','大作战':'⚔️','保卫战':'🛡️','战':'💥',' Jump':'🦖',
  '密令':'🔐','神秘':'🔮','家庭':'🏠','手机':'📱','房子':'🏠','机甲':'🤖',
  'Dino':'🦖','火柴人':'🧍','亨利':'🧍','时刻':'🌙','午夜':'🌙',
  '逃出':'🚪','大楼':'🏢','无名':'❓','洪荒':'⚔️','刃':'🗡️',
  '断电':'💡','密窍':'🔑','零食':'🍿','前线':'🎯','寻找':'🔍',
  'Holalu':'🌍','Land':'🌍','我要回家':'🏠','回家':'🏠','寻宝':'💎',
  '突击队':'🎯','王牌':'🃏','心屿':'🏝️','作业':'📝','爸妈':'👨‍👩‍👦',
  '机械皇帝':'🤖','皇帝':'👑',
};

function pickIcon(title){
  for(const [k,v] of Object.entries(GAME_ICONS)){ if(title.includes(k)) return v; }
  const icons = ['🎮','🕹️','🎯','🚀','⭐','🎪','🎨','🔥'];
  let h=0; for(const c of title) h=(h*31+c.charCodeAt(0))>>>0;
  return icons[h % icons.length];
}

function makeSVG(work, idx){
  const pal = PALETTES[idx % PALETTES.length];
  const icon = pickIcon(work.title);
  const cleanTitle = work.title.replace(/[《》]/g, '').trim();
  const authorText = work.author || '匿名';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs><linearGradient id="bg${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${pal.bg1}"/><stop offset="100%" stop-color="${pal.bg2}"/>
  </linearGradient></defs>
  <rect width="640" height="360" rx="16" fill="url(#bg${idx})"/>
  <circle cx="560" cy="60" r="120" fill="rgba(255,255,255,0.06)"/>
  <circle cx="80" cy="300" r="90" fill="rgba(255,255,255,0.05)"/>
  <circle cx="520" cy="300" r="60" fill="rgba(255,255,255,0.04)"/>
  <text x="320" y="145" font-size="64" text-anchor="middle">${icon}</text>
  <text x="320" y="210" font-size="32" font-weight="bold" text-anchor="middle" fill="#fff"
    font-family="-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">${cleanTitle}</text>
  <text x="320" y="250" font-size="17" text-anchor="middle" fill="#fff" opacity="0.8"
    font-family="-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">作者：${authorText}</text>
  <rect x="220" y="275" width="200" height="3" rx="1.5" fill="${pal.accent}" opacity="0.7"/>
  <text x="20" y="340" font-size="12" fill="#fff" opacity="0.4" font-family="monospace">STUDENT WORKS</text>
</svg>`;
}

async function main(){
  console.log(`开始生成 ${works.length} 张封面图...`);
  for(let i = 0; i < works.length; i++){
    const w = works[i];
    const svgContent = makeSVG(w, i);
    const baseId = w.id.replace(/^w_/, '');
    const pngPath = path.join(UPLOAD_DIR, baseId + '.png');
    try{
      await sharp(Buffer.from(svgContent)).resize(640, 360).png().toFile(pngPath);
      w.image = '/uploads/' + baseId + '.png';
      console.log(`  ✅ ${i+1}/${works.length} ${w.title}`);
    }catch(err){
      console.log(`  ⚠ ${i+1}/${works.length} ${w.title} 失败: ${err.message}`);
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(works, null, 2));
  console.log(`\n完成！重启 server 后生效。`);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
