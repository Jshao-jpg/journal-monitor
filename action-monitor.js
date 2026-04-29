const monitorService = require('./services/monitor');
const notificationService = require('./services/notification');
const fs = require('fs');
const path = require('path');

async function runAction() {
    const username = process.env.EM_USERNAME;
    const password = process.env.EM_PASSWORD;
    const wechatEnabled = !!process.env.WECHAT_WEBHOOK;
    const emailEnabled = !!process.env.EMAIL_USER;

    if (!username || !password) {
        console.error('错误: 未配置 EM_USERNAME 或 EM_PASSWORD 环境变量');
        process.exit(1);
    }

    console.log(`[${new Date().toLocaleString()}] GitHub Action 开始执行检查...`);

    try {
        const currentStatus = await monitorService.checkStatus(username, password);

        // 读取上一次的状态（保存在仓库中或缓存中）
        const historyDir = path.join(__dirname, 'data');
        if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir);

        const lastStatusFile = path.join(historyDir, 'last_status.json');
        let lastStatus = null;
        if (fs.existsSync(lastStatusFile)) {
            lastStatus = JSON.parse(fs.readFileSync(lastStatusFile, 'utf8'));
        }

        // 记录是否是初次运行
        const isFirstRun = !lastStatus;

        // 比较函数：去除所有空格并转小写
        const normalize = (str) => String(str || '').replace(/\s+/g, ' ').trim().toLowerCase();

        // 比较状态 (只比较稿件号和状态，忽略时间戳和空格)
        const simplifiedCurrent = currentStatus.manuscripts.map(m => ({
            id: normalize(m.manuscriptId),
            status: normalize(m.status)
        })).sort((a, b) => a.id.localeCompare(b.id));

        const simplifiedLast = lastStatus ? lastStatus.manuscripts.map(m => ({
            id: normalize(m.manuscriptId),
            status: normalize(m.status)
        })).sort((a, b) => a.id.localeCompare(b.id)) : [];

        const currentStr = JSON.stringify(simplifiedCurrent);
        const lastStr = JSON.stringify(simplifiedLast);
        const hasChanges = lastStatus && currentStr !== lastStr;

        if (hasChanges) {
            console.log('--- 检测到状态变化 ---');
            console.log('上一次简要状态:', lastStr);
            console.log('目前简要状态:', currentStr);
        }

        // 状态提醒计数逻辑
        const counterFile = path.join(historyDir, 'notify_counter.txt');
        let counter = 0;
        if (fs.existsSync(counterFile)) {
            const content = fs.readFileSync(counterFile, 'utf8').trim();
            counter = parseInt(content) || 0;
        }
        counter++;

        let shouldNotify = false;
        let notifyReason = '';

        if (isFirstRun) {
            shouldNotify = true;
            notifyReason = '初次运行（或缓存失效），发送初始状态报告';
            counter = 0;
        } else if (hasChanges) {
            shouldNotify = true;
            notifyReason = '检测到稿件状态更新，立即通知';
            counter = 0; // 重置计数
        } else if (counter >= 24) {
            shouldNotify = true;
            notifyReason = '状态稳定，已满 24 小时例行提醒';
            counter = 0;
        }

        if (shouldNotify) {
            console.log(`>>> 发送通知: ${notifyReason}`);
            await sendNotifications(currentStatus, emailEnabled, wechatEnabled);
        } else {
            console.log(`无状态变化。检查计数: ${counter}/24。满足 24 次检查后将再次提醒。`);
        }

        // 保存当前状态和计数
        // 安全性增强：在保存到文件和打印日志之前，对论文题目进行脱敏处理
        const safeStatusForStorage = {
            ...currentStatus,
            manuscripts: currentStatus.manuscripts.map(m => ({
                ...m,
                title: '*** (Private Title) ***'
            }))
        };

        fs.writeFileSync(lastStatusFile, JSON.stringify(safeStatusForStorage, null, 2));
        fs.writeFileSync(counterFile, counter.toString());

        console.log('检查报告 (脱敏处理):', JSON.stringify(safeStatusForStorage, null, 2));

    } catch (error) {
        console.error('检查过程中出错:', error.message);
        process.exit(1);
    }
}

async function sendNotifications(status, emailEnabled, wechatEnabled) {
    if (emailEnabled) await notificationService.sendEmailNotification(status);
    if (wechatEnabled) await notificationService.sendWechatNotification(status);
}

runAction();
