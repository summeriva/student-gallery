# 学生网页游戏作品展示馆

一个给学生展示自己做的网页游戏作品的小站。老师上传「作品名 + 游戏域名 + 封面图」，访客点卡片就能直接进游戏玩。支持多人共享（数据存在服务端），并带老师口令权限（游客只能看和玩，老师登录后才能发布/删除）。

## 本地运行

```bash
npm install        # 本项目零运行时依赖，此步可省略
node server.js
```

打开 http://localhost:3000 即可。老师默认口令 `teacher123`，可用环境变量覆盖：

```bash
ADMIN_PASSWORD=你的口令 node server.js
```

## 目录结构

```
index.html        页面结构
styles.css        样式
app.js            前端交互（读取作品、登录、发布、删除；连不上后端时自动回退到 works.json 只读展示）
server.js         零依赖 Node 后端（GET/POST/DELETE /api/works、/api/login，托管静态文件）
package.json      启动脚本：npm start
works.json        静态回退用的作品快照（后端不可用时前端只读展示）
uploads/          24 张作品封面图
data/works.json   服务端真实数据（运行后由 server.js 读写）
generate-covers.js 生成封面图的脚本（可选，已生成好无需再跑）
```

## 公网部署

### 方式 A：Render（推荐，可在线增删作品，免费）

1. 把本仓库推到 GitHub（见下方命令）。
2. 打开 [render.com](https://render.com) → **New → Web Service** → 关联仓库。
3. 配置：
   - **Build Command**：`npm install`
   - **Start Command**：`node server.js`
   - **Instance Type**：`Free`
4. **Advanced → Add Environment Variable** 加 `ADMIN_PASSWORD` = 你的发布口令。
5. 创建后等待一两分钟，即获得公网地址（如 `https://student-gallery.onrender.com`）。

### 方式 B：Netlify / Vercel（静态只读，学生能看能玩但不能在线改）

只部署前端：`index.html`、`styles.css`、`app.js`、`works.json`、`uploads/` 五个。前端会自动读取 `works.json` 展示，无需后端。要更新作品就改 `works.json` 重新部署。

> 不建议用 GitHub Pages：地址带仓库二级路径，会把 `/uploads/` 等路径搞错。

## 推送到 GitHub

```bash
git init
git add .
git commit -m "学生作品展示馆"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```
