# Zorth SSH

基于 Electron 的团队共享 SSH 管理工具，服务器列表与加密凭证统一存储在 MySQL，团队成员共享同一份数据。

---

## 功能特性

- **多标签终端** — 同时打开多个 SSH 会话，支持重连
- **双栏文件管理器** — 本地 ↔ 远程 SFTP 文件传输，支持上传/下载/重命名/删除/新建文件夹，带进度条
- **团队共享服务器列表** — 数据存储在 MySQL，所有成员实时共享
- **AES-256 加密存储** — 服务器密码与 SSH 私钥使用团队共享密钥加密，明文不落库
- **SSH Key 认证** — 支持密码和 SSH Key 两种认证方式
- **微服务标签** — 为服务器打标签（如 `gateway,order-service`），侧边栏支持按标签筛选
- **分组管理** — 按项目或环境对服务器分组
- **亮色/暗色主题** — 支持一键切换
- **跨平台** — Windows x64 / Linux ARM64（银河麒麟 V10 兼容）

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 29 + electron-vite |
| 前端 | Vue 3 + Pinia |
| 终端 | xterm.js v5 |
| SSH / SFTP | ssh2 |
| 数据库 | MySQL 8 (mysql2) |
| 加密 | AES-256-CBC (Node.js crypto) |
| 打包 | electron-builder + GitHub Actions |

---

## 开发环境

**依赖**

- Node.js 20+
- MySQL 8 数据库（团队共用一个实例即可）

**安装与启动**

```bash
git clone https://github.com/zorth44/zorth-ssh.git
cd zorth-ssh
npm install
npm run dev
```

---

## 打包发布

本地打包：

```bash
# Linux ARM64
npm run dist:linux

# Windows x64
npm run dist:win
```

**自动打包（推荐）**：推送版本 Tag，GitHub Actions 自动构建并发布到 Releases：

```bash
git tag v1.0.0
git push origin v1.0.0
```

构建完成后在 [Releases](https://github.com/zorth44/zorth-ssh/releases) 页面下载对应平台的安装包。

---

## 首次使用

1. 启动应用，进入初始化向导
2. 填写 MySQL 连接信息（host / port / user / password / database）
3. 设置**团队共享密钥**（所有成员必须填写相同的值，用于加解密服务器密码）
4. 点击「测试连接」通过后保存，应用会自动建表

> 团队共享密钥只需配置一次，之后存在本机，不会上传到数据库。

---

## 在银河麒麟 V10 ARM64 上运行

```bash
# 下载 AppImage 后添加执行权限
chmod +x "Zorth SSH-1.0.0-arm64.AppImage"
./"Zorth SSH-1.0.0-arm64.AppImage"
```

---

## 项目结构

```
src/
├── main/               # Electron 主进程
│   ├── ipc/            # IPC 处理器（settings / servers / terminal / sftp / keys）
│   ├── db.js           # MySQL 连接与表结构初始化
│   └── crypto.js       # AES 加解密
├── preload/            # contextBridge 桥接层
└── renderer/           # Vue 3 前端
    └── src/
        ├── components/ # UI 组件
        ├── stores/     # Pinia 状态管理
        └── composables/
```
