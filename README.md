# 学生网页游戏作品展示馆

一个给学生展示自己做的网页游戏作品的小站。老师上传「作品名 + 游戏域名 + 封面图」，访客点卡片就能直接进游戏玩。支持多人共享（数据存在服务端），并带老师口令权限（游客只能看和玩，老师登录后才能发布/删除）。

## 两种形态

- **公网只读站（已上线）**：`https://summeriva.github.io/student-gallery/`
  任何人可打开浏览、点卡片进游戏玩。由 GitHub Pages 托管，读取仓库里的 `works.json`。
- **公开后端（可在线增删）**：部署到 Render 后，老师用口令登录即可在线发布 / 删除作品。
  后端把改动通过 GitHub API 写回本仓库，所以**只读站会自动同步更新**，且 **Render 临时磁盘在 redeploy 后也不会丢数据**。

## 本地运行

```bash
node server.js
```

打开 http://localhost:3000 即可。老师默认口令 `teacher123`，可用环境变量覆盖：

```bash
ADMIN_PASSWORD=你的口令 node server.js
```

> 本地不带 `GITHUB_TOKEN` 时，数据只存在本机 `works.json`（适合自测）；带上后则写回仓库（见下）。

## 目录结构

```
index.html        页面结构
styles.css        样式
app.js            前端交互（读取作品、登录、发布、删除；连不上后端时自动回退到 works.json 只读展示）
server.js         零依赖 Node 后端（GET/POST/DELETE /api/works、/api/login，托管静态文件）
package.json      启动脚本：npm start
works.json        作品数据（后端与只读站共用的唯一数据源，含 24 件作品与封面路径）
uploads/          作品封面图（含 24 张已生成封面）
generate-covers.js 生成封面图的脚本（可选，已生成好无需再跑）
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ADMIN_PASSWORD` | 否 | 老师登录口令，默认 `teacher123` |
| `GITHUB_TOKEN` | 推荐 | 有 `repo` 权限的 GitHub 令牌；配置后数据写回仓库，实现持久化 + 只读站同步 |
| `GITHUB_REPO` | 否 | 仓库名，默认 `summeriva/student-gallery` |
| `GITHUB_BRANCH` | 否 | 分支，默认 `main` |
| `PORT` | 否 | 监听端口，默认 `3000`（Render 会自动注入） |

## 公网部署（可在线增删 · 免费）

推荐 **Render + 本仓库**：

1. 在 [render.com](https://render.com) 注册并 **New → Web Service**，关联本 GitHub 仓库。
2. 配置：`Build Command` = `npm install`，`Start Command` = `node server.js`，`Instance Type` = `Free`。
3. **Environment** 添加：
   - `ADMIN_PASSWORD` = 你的老师口令
   - `GITHUB_TOKEN` = 一个有 `repo` 权限的 GitHub 令牌（用于把作品写回仓库）
   - `GITHUB_REPO` = `summeriva/student-gallery`
   - `GITHUB_BRANCH` = `main`
4. 创建后获得公网地址（如 `https://student-gallery.onrender.com`）。

也可用仓库根目录的 `render.yaml` 一键部署（Dashboard 选 "New from render.yaml"）。

> ⚠️ 若不配置 `GITHUB_TOKEN`，Render 免费磁盘在 redeploy 时会清空新增作品。配置令牌即可永久保存，并让只读站同步。

## 推送到 GitHub

仓库已初始化并关联 `origin`。日常更新只需：

```bash
git add -A
git commit -m "更新说明"
git push
```
