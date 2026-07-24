# 学生网页游戏作品展示馆

一个给学生展示自己做的网页游戏作品的小站。老师上传「作品名 + 游戏域名 + 封面图」，访客点卡片就能直接进游戏玩。支持多人共享（数据存在服务端），并带老师口令权限（游客只能看和玩，老师登录后才能发布/删除）。

## 两种形态

- **公网只读站（已上线）**：`https://summeriva.github.io/student-gallery/`
  任何人可打开浏览、点卡片进游戏玩。由 GitHub Pages 托管，读取仓库里的 `works.json`。
- **公开后端（可在线增删）**：部署到 Render 或阿里云函数计算后，老师用口令登录即可在线发布 / 删除作品。
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

## 国内部署：阿里云函数计算（国内访问快）

推荐用**函数计算 FC 的自定义运行时（Custom Runtime）**，直接跑现有 Node 服务，无需改代码：

1. 登录 [阿里云函数计算控制台](https://fc.console.aliyun.com)，新建**函数** → 选择「使用自定义运行时创建」。
2. 运行环境选 `custom`，上传本仓库代码包（zip），**启动命令**填 `node server.js`，**监听端口**填 `9000`（FC 会把 HTTP 请求转发到此端口）。
3. 触发器选 **HTTP 触发器**，认证方式 `anonymous`（匿名，所有人可访问），方法勾选 `GET / POST / DELETE / OPTIONS`。
4. 函数配置里添加**环境变量**：
   - `ADMIN_PASSWORD` = 你的老师口令
   - `GITHUB_TOKEN` = 有 `repo` 权限的 GitHub 令牌（用于把作品写回仓库）
   - `GITHUB_REPO` = `summeriva/student-gallery`
   - `GITHUB_BRANCH` = `main`
5. 创建后获得公网地址（形如 `https://<id>.<region>.fc.aliyuncs.com/...`），用老师口令登录即可在线发布 / 删除，GitHub Pages 只读站会自动同步。

> 也可用仓库根目录的 `s.yaml` + [Serverless Devs](https://docs.serverless-devs.com/)（`s` 工具）一键部署：先 `s config add` 配置 AccessKey，再 `s deploy`（部署前本地先 `export GITHUB_TOKEN=你的令牌`）。

> ⚠️ 同样必须配置 `GITHUB_TOKEN`，否则函数实例重启会丢失新增作品。

## 推送到 GitHub

仓库已初始化并关联 `origin`。日常更新只需：

```bash
git add -A
git commit -m "更新说明"
git push
```
