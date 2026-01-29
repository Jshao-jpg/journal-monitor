const nodemailer = require('nodemailer');
const axios = require('axios');

class NotificationService {
    constructor() {
        // 邮件传输器
        this.emailTransporter = null;
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            this.emailTransporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
        }
    }

    // 发送邮件通知
    async sendEmailNotification(statusData) {
        if (!this.emailTransporter) {
            console.log('邮件配置未设置，跳过邮件通知');
            return;
        }

        try {
            const emailContent = this.formatEmailContent(statusData);

            await this.emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.NOTIFICATION_EMAIL,
                subject: '📝 论文审稿状态更新提醒',
                html: emailContent
            });

            console.log('邮件通知已发送');
        } catch (error) {
            console.error('发送邮件失败:', error.message);
        }
    }

    // 发送微信通知
    async sendWechatNotification(statusData) {
        if (!process.env.WECHAT_WEBHOOK) {
            console.log('微信Webhook未设置，跳过微信通知');
            return;
        }

        try {
            const wechatContent = this.formatWechatContent(statusData);

            await axios.post(process.env.WECHAT_WEBHOOK, {
                msgtype: 'markdown',
                markdown: {
                    content: wechatContent
                }
            });

            console.log('微信通知已发送');
        } catch (error) {
            console.error('发送微信通知失败:', error.message);
        }
    }

    // 格式化邮件内容
    formatEmailContent(statusData) {
        const { manuscripts, timestamp } = statusData;

        let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
          <h1 style="color: #667eea; margin: 0 0 20px 0; font-size: 28px;">
            📝 论文状态更新提醒
          </h1>
          
          <div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 5px 0; color: #666;">
              <strong>检查时间:</strong> ${new Date(timestamp).toLocaleString('zh-CN')}
            </p>
            <p style="margin: 5px 0; color: #666;">
              <strong>稿件数量:</strong> ${manuscripts.length} 篇
            </p>
          </div>
          
          <h2 style="color: #333; font-size: 20px; margin: 20px 0 15px 0;">稿件详情</h2>
    `;

        manuscripts.forEach((ms, index) => {
            html += `
        <div style="background: #fff; border-left: 4px solid #667eea; padding: 15px; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
            📄 稿件 #${index + 1}
          </h3>
          <p style="margin: 5px 0; color: #666;"><strong>稿件编号:</strong> ${ms.manuscriptId}</p>
          <p style="margin: 5px 0; color: #666;"><strong>标题:</strong> ${ms.title}</p>
          <p style="margin: 5px 0;">
            <strong>状态:</strong> 
            <span style="background: #4CAF50; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">
              ${ms.status}
            </span>
          </p>
        </div>
      `;
        });

        html += `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 14px;">
            <p>此邮件由论文状态监控系统自动发送</p>
            <p>如需停止接收通知，请登录系统进行设置</p>
          </div>
        </div>
      </div>
    `;

        return html;
    }

    // 格式化微信内容
    formatWechatContent(statusData) {
        const { manuscripts, timestamp } = statusData;

        let content = `## 📝 论文状态更新提醒\n\n`;
        content += `> **检查时间:** ${new Date(timestamp).toLocaleString('zh-CN')}\n`;
        content += `> **稿件数量:** ${manuscripts.length} 篇\n\n`;

        manuscripts.forEach((ms, index) => {
            content += `### 📄 稿件 #${index + 1}\n`;
            content += `**稿件编号:** ${ms.manuscriptId}\n`;
            content += `**标题:** ${ms.title}\n`;
            content += `**状态:** <font color="info">${ms.status}</font>\n\n`;
        });

        content += `---\n`;
        content += `*此消息由论文状态监控系统自动发送*`;

        return content;
    }
}

module.exports = new NotificationService();
