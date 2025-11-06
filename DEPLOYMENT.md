# 在线部署指南

想让别人随时访问「如果当初买黄金」，可以遵循下面的 GitHub Pages 步骤：

1. **Fork 或克隆仓库**：确保仓库已经推送到你的 GitHub 账号。
2. **启用 GitHub Pages**：
   - 打开仓库页面，点击 **Settings → Pages**；
   - 在 "Build and deployment" 中选择 **Source: GitHub Actions**。
3. **推送最新代码**：将 `main` 分支推送到 GitHub；仓库内置的 `.github/workflows/deploy.yml` 会触发自动部署。
4. **等待部署完成**：
   - 在仓库页面点击 **Actions**，可以看到工作流运行状态；
   - 工作流完成后，回到 **Settings → Pages**，复制显示的公开网址（通常是 `https://<用户名>.github.io/IfBuyGold/`）。
5. **分享给其他人**：访问并确认页面正常后，就可以把该网址发送给朋友或直接放在 README 中。

如果想使用其它平台（如 Vercel、Netlify、Cloudflare Pages），只需将 `index.html`、`styles.css`、`script.js` 等静态文件上传或指定为构建产物，同样可以得到一个公开可访问的链接。
