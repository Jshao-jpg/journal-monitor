// 测试脚本 - 直接测试登录和稿件提取
require('dotenv').config();
const monitorService = require('./services/monitor');

console.log('开始测试...\n');

// 直接传入用户名和密码进行测试
const username = process.argv[2] || process.env.EM_USERNAME;
const password = process.argv[3] || process.env.EM_PASSWORD;

if (!username || !password) {
    console.error('❌ 错误: 请提供用户名和密码');
    console.log('\n使用方法:');
    console.log('  node test.js <用户名> <密码>');
    console.log('或');
    console.log('  在 .env 文件中设置 EM_USERNAME 和 EM_PASSWORD');
    process.exit(1);
}

console.log(`测试账号: ${username.substring(0, 3)}***`);
console.log('开始登录测试...\n');

monitorService.checkStatus(username, password)
    .then(result => {
        console.log('\n======== 测试结果 ========');
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ 测试成功！');
            console.log(`找到 ${result.manuscriptCount} 篇稿件`);

            if (result.manuscripts && result.manuscripts.length > 0) {
                console.log('\n稿件详情:');
                result.manuscripts.forEach((ms, index) => {
                    console.log(`  ${index + 1}. ${ms.manuscriptId}`);
                    console.log(`     标题: ${ms.title}`);
                    console.log(`     状态: ${ms.status}`);
                    console.log(`     更新时间: ${ms.lastUpdate}`);
                });
            } else {
                console.log('\n⚠️  未找到稿件');
                console.log('请检查 data/ 目录中的截图文件:');
                console.log('  - login_page.png');
                console.log('  - main_menu.png');
                console.log('  - revisions_page.png');
            }
        } else {
            console.log('\n❌ 测试失败！');
            console.log('错误:', result.error);
        }
    })
    .catch(error => {
        console.error('\n❌ 发生异常:', error.message);
        console.error(error.stack);
    });
