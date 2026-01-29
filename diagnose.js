// 诊断脚本 - 读取并显示登录后的页面HTML结构
const fs = require('fs');
const path = require('path');

// 读取data目录中的所有文件
const dataDir = path.join(__dirname, 'data');

fs.readdir(dataDir, (err, files) => {
    if (err) {
        console.error('无法读取data目录:', err);
        return;
    }

    console.log('📁 data目录中的文件:');
    files.forEach(file => {
        const filePath = path.join(dataDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });

    // 读取状态历史
    const historyFile = path.join(dataDir, 'status_history.json');
    if (fs.existsSync(historyFile)) {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        console.log('\n📊 最近的检查记录:');
        history.history.slice(0, 3).forEach((record, index) => {
            console.log(`\n  记录 ${index + 1}:`);
            console.log(`  时间: ${new Date(record.timestamp).toLocaleString('zh-CN')}`);
            console.log(`  成功: ${record.success ? '✅' : '❌'}`);
            if (record.success) {
                console.log(`  稿件数量: ${record.manuscriptCount}`);
                if (record.manuscripts && record.manuscripts.length > 0) {
                    record.manuscripts.forEach(ms => {
                        console.log(`    - ${ms.manuscriptId}: ${ms.status}`);
                    });
                }
            } else {
                console.log(`  错误: ${record.error}`);
            }
        });
    }

    // 读取配置
    const configFile = path.join(dataDir, 'config.json');
    if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        console.log('\n⚙️  当前配置:');
        console.log(`  用户名: ${config.username ? '已设置' : '未设置'}`);
        console.log(`  密码: ${config.password ? '已设置' : '未设置'}`);
        console.log(`  邮件通知: ${config.emailEnabled ? '启用' : '禁用'}`);
        console.log(`  微信通知: ${config.wechatEnabled ? '启用' : '禁用'}`);
    }
});
