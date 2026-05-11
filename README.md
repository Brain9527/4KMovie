# 🎬 4K 电影磁力搜索工具

这是一个基于 Vue 3 开发的轻量级、响应式的电影磁力链接搜索工具。用户可以通过上传 Excel (.xls) 文件来管理电影资源，并实现快速的模糊搜索和磁力链接复制。

## 🌐 在线地址
[https://brain9527.github.io/4KMovie/](https://brain9527.github.io/4KMovie/)

## ✨ 功能特性

- 🔍 **智能模糊搜索**：基于 Fuse.js，支持电影名、中文名的快速模糊匹配。
- 📊 **Excel 数据驱动**：直接读取 `public/data/movies.xls`，方便批量更新资源。
- 📋 **一键复制**：点击即可将磁力链接复制到剪贴板。
- 📱 **响应式设计**：适配 PC 和移动端，界面简洁美观（基于 Element Plus）。
- 🚀 **自动化部署**：内置 GitHub Actions 工作流，推送代码即可自动发布到 GitHub Pages。

## 🛠️ 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **UI 组件库**: Element Plus
- **数据处理**: XLSX (SheetJS)
- **搜索算法**: Fuse.js
- **部署**: GitHub Actions

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <your-repository-url>
cd 4KMovie
```

### 2. 安装依赖
```bash
npm install
```

### 3. 本地开发
```bash
npm run dev
```
访问 `http://localhost:5173` 预览项目。

### 4. 构建发布
```bash
npm run build
```

## 📂 数据配置说明

请将您的电影资源 Excel 文件放在以下路径：
`public/data/movies.xls`

**Excel 表格格式要求：**

| 电影名 | 中文名 | 磁力 |
| :--- | :--- | :--- |
| Inception | 盗梦空间 | magnet:?xt=... |
| Interstellar | 星际穿越 | magnet:?xt=... |

> **注意**：请确保列名与上述一致，否则会导致解析失败。

## 🌐 部署到 GitHub Pages

1. 将代码推送到 GitHub 的 `main` 分支。
2. 在 GitHub 仓库设置中：`Settings` > `Pages` > `Build and deployment` > `Source` 选择 **GitHub Actions**。
3. 等待工作流执行完毕，您的网站将自动上线。

## 📝 许可证

MIT License
