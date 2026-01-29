// 应用状态
let monitoringActive = false;
let currentConfig = null;

// DOM元素
const configForm = document.getElementById('configForm');
const testBtn = document.getElementById('testBtn');
const startBtn = document.getElementById('startBtn');
const refreshBtn = document.getElementById('refreshBtn');
const monitorStatus = document.getElementById('monitorStatus');
const currentStatusEl = document.getElementById('currentStatus');
const historyListEl = document.getElementById('historyList');
const historyFilter = document.getElementById('historyFilter');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadHistory();
    setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
    configForm.addEventListener('submit', handleStartMonitoring);
    testBtn.addEventListener('click', handleTestConnection);
    refreshBtn.addEventListener('click', handleRefresh);
    historyFilter.addEventListener('change', loadHistory);
}

// 加载配置
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        if (config.username) {
            document.getElementById('username').value = config.username;
            document.getElementById('emailEnabled').checked = config.emailEnabled || false;
            document.getElementById('wechatEnabled').checked = config.wechatEnabled || false;
            document.getElementById('notificationEmail').value = config.notificationEmail || '';
        }

        currentConfig = config;
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

// 加载历史记录
async function loadHistory() {
    try {
        const response = await fetch('/api/status/history');
        const data = await response.json();

        if (!data.history || data.history.length === 0) {
            historyListEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>暂无历史记录</p>
                </div>
            `;
            return;
        }

        // 根据过滤器筛选
        const filter = historyFilter.value;
        const now = new Date();
        const filtered = data.history.filter(item => {
            const itemDate = new Date(item.timestamp);

            switch (filter) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                default:
                    return true;
            }
        });

        historyListEl.innerHTML = filtered.map(item => `
            <div class="history-item">
                <div class="history-time">${formatDateTime(item.timestamp)}</div>
                ${item.success ? renderManuscripts(item.manuscripts) : `
                    <div style="color: var(--error-color);">
                        ❌ 检查失败: ${item.error}
                    </div>
                `}
            </div>
        `).join('');

    } catch (error) {
        console.error('加载历史记录失败:', error);
    }
}

// 测试连接
async function handleTestConnection() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showToast('请输入用户名和密码', 'warning');
        return;
    }

    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="btn-icon">⏳</span>正在测试...';

    try {
        const response = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`✅ 连接成功！找到 ${result.manuscriptCount} 篇稿件`, 'success');
            displayCurrentStatus(result);
            await loadHistory();
        } else {
            showToast(`❌ 连接失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`❌ 测试失败: ${error.message}`, 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<span class="btn-icon">🧪</span>测试连接';
    }
}

// 启动监控
async function handleStartMonitoring(e) {
    e.preventDefault();

    const formData = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        emailEnabled: document.getElementById('emailEnabled').checked,
        wechatEnabled: document.getElementById('wechatEnabled').checked,
        notificationEmail: document.getElementById('notificationEmail').value,
        autoStart: true
    };

    if (!formData.username || !formData.password) {
        showToast('请输入用户名和密码', 'warning');
        return;
    }

    if (!formData.emailEnabled && !formData.wechatEnabled) {
        showToast('请至少选择一种通知方式', 'warning');
        return;
    }

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="btn-icon">⏳</span>启动中...';

    try {
        const response = await fetch('/api/monitor/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            monitoringActive = true;
            updateMonitorStatus(true);
            showToast('✅ 监控已启动！系统将每小时自动检查一次', 'success');

            // 执行首次检查
            await handleTestConnection();
        } else {
            showToast(`❌ 启动失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`❌ 启动失败: ${error.message}`, 'error');
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = '<span class="btn-icon">▶️</span>启动监控';
    }
}

// 手动刷新
async function handleRefresh() {
    if (!currentConfig || !currentConfig.username) {
        showToast('请先配置并测试连接', 'warning');
        return;
    }

    await handleTestConnection();
}

// 更新监控状态显示
function updateMonitorStatus(active) {
    if (active) {
        monitorStatus.classList.add('active');
        monitorStatus.querySelector('.status-text').textContent = '监控运行中';
    } else {
        monitorStatus.classList.remove('active');
        monitorStatus.querySelector('.status-text').textContent = '监控未启动';
    }
}

// 显示当前状态
function displayCurrentStatus(data) {
    if (!data.success || !data.manuscripts || data.manuscripts.length === 0) {
        currentStatusEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>未找到稿件</p>
                <small>请确认您有提交的稿件</small>
            </div>
        `;
        return;
    }

    currentStatusEl.innerHTML = `
        <div class="manuscripts-list">
            ${data.manuscripts.map((ms, index) => `
                <div class="manuscript-item" style="animation-delay: ${index * 0.1}s">
                    <div class="manuscript-header">
                        <div class="manuscript-id">📄 ${ms.manuscriptId}</div>
                        <div class="manuscript-status">${ms.status}</div>
                    </div>
                    <div class="manuscript-title">${ms.title}</div>
                    <div class="manuscript-meta">
                        最后更新: ${formatDateTime(ms.lastUpdate)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// 渲染稿件列表（用于历史记录）
function renderManuscripts(manuscripts) {
    if (!manuscripts || manuscripts.length === 0) {
        return '<p style="color: var(--text-secondary);">未找到稿件</p>';
    }

    return `
        <div style="font-size: 0.9rem;">
            <strong>共 ${manuscripts.length} 篇稿件:</strong>
            ${manuscripts.map(ms => `
                <div style="margin-top: 0.5rem; padding-left: 1rem; border-left: 2px solid var(--primary-color);">
                    ${ms.manuscriptId} - ${ms.status}
                </div>
            `).join('')}
        </div>
    `;
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }

    // 小于1小时
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分钟前`;
    }

    // 小于24小时
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    }

    // 显示完整日期
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示Toast通知
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// 定期更新历史记录（每5分钟）
setInterval(loadHistory, 5 * 60 * 1000);
