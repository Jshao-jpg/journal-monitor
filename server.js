const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
require('dotenv').config();

const monitorService = require('./services/monitor');
const notificationService = require('./services/notification');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 中间件
app.use(bodyParser.json());
app.use(express.static('public'));

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// 获取状态历史
app.get('/api/status/history', async (req, res) => {
  try {
    const historyFile = path.join(DATA_DIR, 'status_history.json');
    try {
      const data = await fs.readFile(historyFile, 'utf-8');
      res.json(JSON.parse(data));
    } catch {
      res.json({ history: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取当前配置
app.get('/api/config', async (req, res) => {
  try {
    const configFile = path.join(DATA_DIR, 'config.json');
    try {
      const data = await fs.readFile(configFile, 'utf-8');
      res.json(JSON.parse(data));
    } catch {
      res.json({
        username: '',
        notificationEmail: process.env.NOTIFICATION_EMAIL || '',
        wechatEnabled: !!process.env.WECHAT_WEBHOOK,
        emailEnabled: false,
        checkInterval: parseInt(process.env.CHECK_INTERVAL_HOURS) || 1
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存配置
app.post('/api/config', async (req, res) => {
  try {
    const configFile = path.join(DATA_DIR, 'config.json');
    await fs.writeFile(configFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 手动检查状态
app.post('/api/check', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await monitorService.checkStatus(username, password);

    // 保存到历史记录
    await saveToHistory(result);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 开始监控
app.post('/api/monitor/start', async (req, res) => {
  try {
    const { username, password, emailEnabled, wechatEnabled } = req.body;

    // 保存配置
    const configFile = path.join(DATA_DIR, 'config.json');
    await fs.writeFile(configFile, JSON.stringify(req.body, null, 2));

    // 启动定时任务
    startMonitoring(username, password, emailEnabled, wechatEnabled);

    res.json({ success: true, message: '监控已启动' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存状态到历史记录
async function saveToHistory(statusData) {
  const historyFile = path.join(DATA_DIR, 'status_history.json');
  let history = { history: [] };

  try {
    const data = await fs.readFile(historyFile, 'utf-8');
    history = JSON.parse(data);
  } catch { }

  history.history.unshift({
    timestamp: new Date().toISOString(),
    ...statusData
  });

  // 只保留最近100条记录
  history.history = history.history.slice(0, 100);

  await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
}

// 检查状态变化
async function checkForChanges(currentStatus, previousStatus) {
  if (!previousStatus) return true;

  // 比较状态是否有变化
  return JSON.stringify(currentStatus.manuscripts) !== JSON.stringify(previousStatus.manuscripts);
}

// 启动监控
let monitoringTask = null;
let lastStatus = null;
let lastNotificationTime = Date.now(); // 记录上次发送通知的时间，设为当前时间以避免启动即通知

async function startMonitoring(username, password, emailEnabled, wechatEnabled) {
  // 取消之前的任务
  if (monitoringTask) {
    monitoringTask.stop();
  }

  const checkInterval = parseInt(process.env.CHECK_INTERVAL_HOURS) || 1;
  const forceNotifyIntervalMs = 24 * 60 * 60 * 1000; // 24小时强制通知一次

  // 创建定时任务（每小时检查）
  monitoringTask = cron.schedule(`0 */${checkInterval} * * *`, async () => {
    console.log(`[${new Date().toLocaleString()}] 正在检查论文状态...`);

    try {
      const currentStatus = await monitorService.checkStatus(username, password);
      await saveToHistory(currentStatus);

      // 检查是否有变化
      const hasChanges = await checkForChanges(currentStatus, lastStatus);
      const now = Date.now();
      const shouldForceNotify = !lastNotificationTime || (now - lastNotificationTime >= forceNotifyIntervalMs);

      if (hasChanges && lastStatus) {
        console.log('检测到状态变化，立即发送通知...');
        await sendAllNotifications(currentStatus, emailEnabled, wechatEnabled);
        lastNotificationTime = now;
      } else if (shouldForceNotify) {
        console.log('状态未变，但满足24小时提醒周期，发送日常通知...');
        await sendAllNotifications(currentStatus, emailEnabled, wechatEnabled);
        lastNotificationTime = now;
      } else {
        console.log('状态未变，本次不发送通知');
      }

      lastStatus = currentStatus;
      console.log('检查完成');
    } catch (error) {
      console.error('检查失败:', error.message);
    }
  });

  console.log(`监控已启动，每${checkInterval}小时检查一次，状态改变立即通知，无变化24小时提醒一次`);
}

// 统一发送通知的函数
async function sendAllNotifications(status, emailEnabled, wechatEnabled) {
  try {
    if (emailEnabled) {
      await notificationService.sendEmailNotification(status);
    }
    if (wechatEnabled) {
      await notificationService.sendWechatNotification(status);
    }
  } catch (err) {
    console.error('发送通知过程出错:', err.message);
  }
}

// 启动服务器
async function start() {
  await ensureDataDir();

  app.listen(PORT, () => {
    console.log(`\n🚀 论文状态监控系统已启动！`);
    console.log(`📱 访问地址: http://localhost:${PORT}`);
    console.log(`⏰ 检查频率: 每${process.env.CHECK_INTERVAL_HOURS || 1}小时\n`);
  });

  // 尝试自动启动监控（如果有保存的配置）
  try {
    const configFile = path.join(DATA_DIR, 'config.json');
    const data = await fs.readFile(configFile, 'utf-8');
    const config = JSON.parse(data);

    if (config.username && config.password && config.autoStart) {
      console.log('检测到保存的配置，自动启动监控...');
      startMonitoring(config.username, config.password, config.emailEnabled, config.wechatEnabled);
    }
  } catch { }
}

start();
