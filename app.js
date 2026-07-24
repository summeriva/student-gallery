/* ===== 学生作品展示馆 · 前端逻辑（多人共享 + 老师权限） ===== */
const gallery     = document.getElementById('gallery');
const emptyState  = document.getElementById('emptyState');
const workCount   = document.getElementById('workCount');
const searchInput = document.getElementById('searchInput');
const filterBar   = document.getElementById('filterBar');
const modal       = document.getElementById('addModal');
const addForm     = document.getElementById('addForm');
const imageInput  = document.getElementById('imageInput');
const imagePreview= document.getElementById('imagePreview');
const openAddBtn  = document.getElementById('openAddBtn');
const teacherBtn  = document.getElementById('teacherBtn');
const loginModal  = document.getElementById('loginModal');
const loginForm   = document.getElementById('loginForm');
const loginHint   = document.getElementById('loginHint');
const toastBox    = document.getElementById('toast');

let works = [];
let activeFilter = '全部';
let searchTerm = '';
let pendingImage = null;
let adminToken = localStorage.getItem('gallery_admin_token') || '';
let backendAvailable = false;   // 是否能连上后端 API（动态模式）；否则为静态只读模式

/* ---------- 权限界面 ---------- */
function applyAdminUI(){
  if(backendAvailable && adminToken){
    document.body.classList.add('admin');
    teacherBtn.textContent = '退出老师模式';
    teacherBtn.style.display = '';
  } else {
    document.body.classList.remove('admin');
    teacherBtn.textContent = '老师入口';
    /* 静态只读模式下隐藏老师入口（无后端可登录） */
    teacherBtn.style.display = backendAvailable ? '' : 'none';
  }
}
function handleUnauthorized(){
  adminToken = '';
  localStorage.removeItem('gallery_admin_token');
  applyAdminUI();
  showToast('口令已失效，请重新登录', true);
  openLogin();
}

/* ---------- 数据接口 ---------- */
async function loadWorks(){
  /* 优先连后端（动态模式：可增删、有权限） */
  try{
    const res = await fetch('/api/works');
    if(res.ok){ works = await res.json(); backendAvailable = true; applyAdminUI(); render(); return; }
  }catch(e){ /* 后端不可用，继续走静态回退 */ }

  /* 静态部署回退：读取站点内置的作品快照（只读展示，所有人可看可玩） */
  try{
    const res2 = await fetch('works.json');
    if(res2.ok){
      works = await res2.json();
      backendAvailable = false;
      applyAdminUI();
      render();
      showToast('当前为静态展示模式（只读），发布作品请在本地后端进行', true);
      return;
    }
  }catch(e){}

  works = [];
  showToast('无法加载作品数据', true);
  render();
}

async function addWork(payload){
  const res = await fetch('/api/works', {
    method:'POST',
    headers:{'Content-Type':'application/json', 'x-admin-token': adminToken},
    body: JSON.stringify(payload)
  });
  if(res.status === 401){ handleUnauthorized(); return false; }
  if(!res.ok){ showToast('保存失败：' + (await res.json()).error, true); return false; }
  const saved = await res.json();
  works.unshift(saved);
  render(); closeModal();
  showToast('作品已发布，所有人都能看到了 🎉');
  return true;
}

async function removeWork(id){
  if(!confirm('确定要删除这件作品吗？')) return;
  const res = await fetch('/api/works/' + id, { method:'DELETE', headers:{'x-admin-token': adminToken} });
  if(res.status === 401){ handleUnauthorized(); return; }
  if(res.ok){ works = works.filter(w => w.id !== id); render(); showToast('已删除'); }
  else showToast('删除失败', true);
}

/* ---------- 工具 ---------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizeDomain(u){
  u = (u||'').trim();
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function hostOf(u){
  try{ return new URL(normalizeDomain(u)).host; }catch(e){ return u; }
}
const EMOJIS = ['🚀','🌲','🏃','🔢','🐉','⚔️','🎯','🧩','🛸','🍎'];
function emojiFor(title){
  let h=0; for(const c of title) h=(h*31+c.charCodeAt(0))>>>0;
  return EMOJIS[h % EMOJIS.length];
}
function gradient(color){
  return `linear-gradient(135deg, ${color}, ${color}cc)`;
}
let toastTimer;
function showToast(msg, isError){
  if(!toastBox) return;
  toastBox.textContent = msg;
  toastBox.className = 'toast' + (isError ? ' error' : '');
  toastBox.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastBox.hidden = true; }, 2600);
}

/* ---------- 渲染 ---------- */
function render(){
  workCount.textContent = works.length;

  const term = searchTerm.trim().toLowerCase();
  let list = works.filter(w => {
    const matchTerm = !term || w.title.toLowerCase().includes(term) || (w.author||'').toLowerCase().includes(term);
    const matchFilter = activeFilter === '全部' || (w.author||'') === activeFilter;
    return matchTerm && matchFilter;
  });

  gallery.innerHTML = list.map(cardHTML).join('');
  emptyState.hidden = works.length !== 0;
  if(list.length === 0 && works.length !== 0){
    gallery.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:40px">没有匹配的作品。</p>';
  }

  renderFilters();
}

function cardHTML(w){
  /* 统一成相对路径：去掉开头的 '/'，确保在 GitHub Pages 等子路径托管下也能正确加载 */
  const imgSrc = w.image ? (w.image.charAt(0) === '/' ? w.image.slice(1) : w.image) : '';
  const media = imgSrc
    ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(w.title)}" loading="lazy" />`
    : `<div class="ph" style="background:${gradient(w.color||'#6366f1')}"><span>${emojiFor(w.title)}</span></div>`;
  return `
  <article class="card" data-id="${w.id}" tabindex="0" role="button" aria-label="打开 ${escapeHtml(w.title)}">
    <div class="card-media">${media}
      <button class="del-btn" title="删除作品" data-del="${w.id}" aria-label="删除">🗑</button>
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(w.title)}</h3>
      ${w.author ? `<p class="card-author">${escapeHtml(w.author)}</p>` : ''}
      <div class="card-foot">
        <span class="domain-chip" title="${escapeHtml(w.domain)}">${escapeHtml(hostOf(w.domain))}</span>
        <span class="play-btn">进入游戏 →</span>
      </div>
    </div>
  </article>`;
}

function renderFilters(){
  const authors = ['全部', ...Array.from(new Set(works.map(w => w.author).filter(Boolean)))];
  if(authors.length <= 1){ filterBar.innerHTML=''; return; }
  filterBar.innerHTML = authors.map(a =>
    `<button class="chip ${a===activeFilter?'active':''}" data-filter="${escapeHtml(a)}">${escapeHtml(a)}</button>`
  ).join('');
}

/* ---------- 交互 ---------- */
gallery.addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if(del){ e.stopPropagation(); removeWork(del.getAttribute('data-del')); return; }
  const card = e.target.closest('.card');
  if(card){ openGame(card.getAttribute('data-id')); }
});
gallery.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){
    const card = e.target.closest('.card');
    if(card){ e.preventDefault(); openGame(card.getAttribute('data-id')); }
  }
});

function openGame(id){
  const w = works.find(x => x.id === id);
  if(w) window.open(normalizeDomain(w.domain), '_blank', 'noopener');
}

filterBar.addEventListener('click', e => {
  const chip = e.target.closest('[data-filter]');
  if(chip){ activeFilter = chip.getAttribute('data-filter'); render(); }
});
searchInput.addEventListener('input', e => { searchTerm = e.target.value; render(); });

/* ---------- 添加作品弹窗 ---------- */
function openModal(){ modal.hidden = false; document.body.style.overflow='hidden'; }
function closeModal(){
  modal.hidden = true; document.body.style.overflow='';
  addForm.reset(); pendingImage=null; imagePreview.hidden=true; imagePreview.innerHTML='';
}
openAddBtn.addEventListener('click', openModal);
modal.addEventListener('click', e => { if(e.target.hasAttribute('data-close')) closeModal(); });

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if(!file) return;
  if(file.size > 3 * 1024 * 1024){ showToast('图片请控制在 3MB 以内', true); imageInput.value=''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage = reader.result;
    imagePreview.hidden = false;
    imagePreview.innerHTML = `<img src="${pendingImage}" alt="预览" />`;
  };
  reader.readAsDataURL(file);
});

addForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(addForm);
  const title  = (data.get('title')||'').trim();
  const domain = (data.get('domain')||'').trim();
  const author = (data.get('author')||'').trim();
  if(!title || !domain){ showToast('请填写作品名和游戏域名', true); return; }
  addWork({ title, domain, author, image: pendingImage || null });
});

/* ---------- 老师登录 ---------- */
function openLogin(){ loginHint.textContent=''; loginForm.reset(); loginModal.hidden=false; document.body.style.overflow='hidden'; loginForm.password.focus(); }
function closeLogin(){ loginModal.hidden=true; document.body.style.overflow=''; }
teacherBtn.addEventListener('click', () => {
  if(adminToken){ if(confirm('退出老师模式？将不能再发布或删除作品。')) logout(); }
  else openLogin();
});
loginModal.addEventListener('click', e => { if(e.target.hasAttribute('data-close-login')) closeLogin(); });
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const pw = loginForm.password.value;
  try{
    const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) });
    if(res.ok){
      const d = await res.json();
      adminToken = d.token;
      localStorage.setItem('gallery_admin_token', adminToken);
      applyAdminUI(); closeLogin();
      showToast('已进入老师模式');
    } else {
      loginHint.textContent = '口令错误，请重试';
    }
  }catch(err){ loginHint.textContent = '登录失败，请确认服务已启动'; }
});
function logout(){
  adminToken = '';
  localStorage.removeItem('gallery_admin_token');
  applyAdminUI();
  showToast('已退出老师模式');
}

document.addEventListener('keydown', e => {
  if(e.key==='Escape'){ if(!modal.hidden) closeModal(); if(!loginModal.hidden) closeLogin(); }
});

/* ---------- 启动 ---------- */
applyAdminUI();
loadWorks();
