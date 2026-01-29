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

        // 比较状态 (只比较稿件号和状态，忽略时间戳和空格)
        const simplifiedCurrent = currentStatus.manuscripts.map(m => ({
            id: String(m.manuscriptId || '').trim(),
            status: String(m.status || '').trim()
        })).sort((a, b) => a.id.localeCompare(b.id));

        const simplifiedLast = lastStatus ? lastStatus.manuscripts.map(m => ({
            id: String(m.manuscriptId || '').trim(),
            status: String(m.status || '').trim()
        })).sort((a, b) => a.id.localeCompare(b.id)) : [];

        const currentStr = JSON.stringify(simplifiedCurrent);
        const lastStr = JSON.stringify(simplifiedLast);
        const hasChanges = lastStatus && currentStr !== lastStr;

        if (hasChanges) {
            console.log('--- 检出状态变化 ---');
            console.log('之前状态:', lastStr);
            console.log('当前状态:', currentStr);
        }

        // 强制通知逻辑：每 24 条记录（约24小时）通知一次，或者状态改变时通知
        const counterFile = path.join(historyDir, 'notify_counter.txt');
        let counter = 0;
        if (fs.existsSync(counterFile)) counter = parseInt(fs.readFileSync(counterFile, 'utf8')) || 0;
        counter++;

        if (isFirstRun) {
            console.log('检测到初次运行（Cache未命中），保存初始状态，本次静默...');
            counter = 0;
        } else if (hasChanges) {
            console.log('检测到状态变化，发送立即通知！');
            await sendNotifications(currentStatus, emailEnabled, wechatEnabled);
            counter = 0; // 重置计数
        } else if (counter >= 24) {
            console.log('状态未变，但已累积24次检查（约24小时），发送例行汇报...');
            await sendNotifications(currentStatus, emailEnabled, wechatEnabled);
            counter = 0;
        } else {
            console.log(`状态无变化。检查计数: ${counter}/24，跳过通知。`);
        }

        // 保存当前状态和计数
        fs.writeFileSync(lastStatusFile, JSON.stringify(currentStatus, null, 2));
        fs.writeFileSync(counterFile, counter.toString());

        console.log('检查报告:', JSON.stringify(currentStatus, null, 2));

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
