# 📝 论文审稿状态监控系统

一个自动监控 Editorial Manager 系统中论文审稿状态的Web应用，支持邮件和微信通知。

## ✨ 功能特点

- 🔐 **自动登录**: 安全保存登录凭证，自动登录 Editorial Manager
- ⏰ **定时监控**: 每小时自动检查论文状态
- 🔔 **多种通知**: 支持邮件和企业微信通知
- 📊 **状态展示**: 实时显示当前所有稿件状态
- 📜 **历史记录**: 完整的状态变化历史追踪
- 🎨 **现代界面**: 精美的深色主题UI设计
- 🔒 **本地存储**: 所有数据仅存储在本地，保护隐私

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置:

```bash
copy .env.example .env
```

编辑 `.env` 文件:

```env
# Editorial Manager 登录信息（也可以在网页界面中输入）
EM_USERNAME=your_email@example.com
EM_PASSWORD=your_password

# 邮件通知配置（如果使用邮件通知）
EMAIL_SERVICE=gmail
EMAIL_USER=your_notification_email@gmail.com
EMAIL_PASS=your_app_password
NOTIFICATION_EMAIL=receiver@example.com

# 微信通知配置（如果使用企业微信通知）
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key

# 监控配置
CHECK_INTERVAL_HOURS=1
SERVER_PORT=3000
```

### 3. 启动应用

```bash
npm start
```

访问 http://localhost:3000 即可使用！

## 📧 邮件通知配置

### Gmail 配置示例

1. 启用两步验证
2. 生成应用专用密码: https://myaccount.google.com/apppasswords
3. 在 `.env` 中配置:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
NOTIFICATION_EMAIL=receiver@example.com
```

### QQ邮箱配置示例

```env
EMAIL_SERVICE=QQ
EMAIL_USER=your_qq@qq.com
EMAIL_PASS=your_authorization_code
NOTIFICATION_EMAIL=receiver@example.com
```

## 💬 微信通知配置

使用企业微信机器人:

1. 在企业微信群中添加机器人
2. 获取 Webhook URL
3. 在 `.env` 中配置:

```env
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key
```

## 📱 使用说明

### 首次使用

1. 打开网页界面 http://localhost:3000
2. 输入 Editorial Manager 的用户名和密码
3. 选择通知方式（邮件/微信）
4. 点击"测试连接"验证配置
5. 点击"启动监控"开始自动监控

### 功能说明

- **测试连接**: 立即检查一次论文状态，不启动定时监控
- **启动监控**: 启动定时监控，每小时自动检查一次
- **手动刷新**: 立即执行一次状态检查
- **历史记录**: 查看所有检查记录，可按时间筛选

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **浏览器自动化**: Puppeteer
- **定时任务**: node-cron
- **邮件发送**: Nodemailer
- **前端**: 原生 HTML/CSS/JavaScript

## 📂 项目结构

```
paper-status-monitor/
├── public/              # 前端文件
│   ├── index.html      # 主页面
│   ├── styles.css      # 样式文件
│   └── app.js          # 前端逻辑
├── services/           # 后端服务
│   ├── monitor.js      # 监控服务
│   └── notification.js # 通知服务
├── data/               # 数据存储（自动生成）
│   ├── config.json     # 用户配置
│   └── status_history.json  # 历史记录
├── server.js           # 服务器主文件
├── package.json        # 项目配置
├── .env                # 环境变量
└── README.md           # 说明文档
```

## ⚠️ 注意事项

1. **登录信息安全**: 
   - 您的登录信息仅存储在本地
   - 不会上传到任何远程服务器
   - 建议定期更改密码

2. **检查频率**:
   - 默认每小时检查一次
   - 避免频繁检查以防被系统限制

3. **浏览器要求**:
   - 程序使用 Puppeteer 自动化浏览器
   - 首次运行会自动下载 Chromium

4. **网络要求**:
   - 需要能够访问 editorialmanager.com
   - 发送通知需要网络连接

## 🐛 常见问题

### Q: 登录失败怎么办？
A: 请检查:
- 用户名和密码是否正确
- 网络连接是否正常
- Editorial Manager 网站是否可访问

### Q: 收不到通知？
A: 请检查:
- 邮件配置是否正确（用户名、密码、服务商）
- 微信 Webhook URL 是否有效
- 在网页界面中是否勾选了对应的通知方式

### Q: 如何停止监控？
A: 关闭应用或重启服务器即可停止监控

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请在 GitHub 上提交 Issue。

---

**祝您的论文审稿顺利！** 🎓✨
