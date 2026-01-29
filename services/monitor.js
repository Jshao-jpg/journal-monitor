const puppeteer = require('puppeteer');

class MonitorService {
    async checkStatus(username, password) {
        let browser = null;

        try {
            console.log('启动浏览器...');
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });

            // 访问登录页面
            console.log('访问登录页面...');
            await page.goto('https://www.editorialmanager.com/jolt/Default.aspx', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // 等待页面完全加载（包括JavaScript）
            console.log('等待页面加载...');
            await page.waitForTimeout(5000); // 增加等待时间

            // 查找包含登录表单的frame
            let loginFrame = null;
            let retryCount = 0;
            const maxRetries = 5;

            while (!loginFrame && retryCount < maxRetries) {
                const frames = page.frames();
                console.log(`尝试第 ${retryCount + 1} 次检测 frame, 当前共有 ${frames.length} 个frame`);

                for (const frame of frames) {
                    const frameUrl = frame.url();
                    // 检查这个frame中是否有登录表单
                    try {
                        const hasLoginForm = await frame.evaluate(() => {
                            const textInputs = document.querySelectorAll('input[type="text"], input[type="email"]');
                            const passwordInputs = document.querySelectorAll('input[type="password"]');
                            return textInputs.length > 0 && passwordInputs.length > 0;
                        });

                        if (hasLoginForm) {
                            console.log(`找到包含登录表单的frame: ${frameUrl}`);
                            loginFrame = frame;
                            break;
                        }
                    } catch (e) {
                        // 忽略 evaluate 错误
                    }
                }

                if (!loginFrame) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log('未找到登录表单，等待 2 秒后重试...');
                        await page.waitForTimeout(2000);
                    }
                }
            }

            if (!loginFrame) {
                console.log('在所有 frame 中均未找到登录表单，回退到主页面。');
                loginFrame = page;
            }

            // 保存页面截图用于调试
            try {
                await page.screenshot({ path: 'data/login_page.png', fullPage: true });
                console.log('已保存登录页面截图到 data/login_page.png');
            } catch (e) {
                console.log('无法保存截图:', e.message);
            }

            // 打印页面中所有可见的输入框
            const allInputs = await loginFrame.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input'));
                return inputs
                    .filter(input => {
                        const style = window.getComputedStyle(input);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    })
                    .map(input => ({
                        type: input.type,
                        name: input.name,
                        id: input.id,
                        className: input.className,
                        placeholder: input.placeholder,
                        visible: true
                    }));
            });
            console.log('页面中所有可见的输入框:', JSON.stringify(allInputs, null, 2));

            // 尝试多种方式查找用户名输入框
            console.log('查找用户名输入框...');
            const usernameSelectors = [
                'input[type="text"]',
                'input[type="email"]',
                '#username',
                'input[name="username"]',
                '#loginID',
                'input[id*="username" i]',
                'input[id*="email" i]',
                'input[name*="email" i]',
                'input[placeholder*="mail" i]',
                'input[placeholder*="user" i]'
            ];

            let usernameInput = null;
            let usernameSelector = null;
            for (const selector of usernameSelectors) {
                try {
                    usernameInput = await loginFrame.$(selector);
                    if (usernameInput) {
                        console.log(`✓ 找到用户名输入框: ${selector}`);
                        usernameSelector = selector;
                        break;
                    }
                } catch (e) {
                    // 继续尝试下一个选择器
                }
            }

            if (!usernameInput) {
                throw new Error('无法找到用户名输入框。请查看 data/login_page.png 截图，并检查页面结构。');
            }

            // 查找密码输入框
            console.log('查找密码输入框...');
            const passwordSelectors = [
                'input[type="password"]',
                '#password',
                'input[name="password"]',
                'input[id*="password" i]'
            ];

            let passwordInput = null;
            let passwordSelector = null;
            for (const selector of passwordSelectors) {
                try {
                    passwordInput = await loginFrame.$(selector);
                    if (passwordInput) {
                        console.log(`✓ 找到密码输入框: ${selector}`);
                        passwordSelector = selector;
                        break;
                    }
                } catch (e) {
                    // 继续尝试
                }
            }

            if (!passwordInput) {
                throw new Error('无法找到密码输入框');
            }

            // 验证登录信息
            if (!username || !password) {
                throw new Error('用户名或密码不能为空');
            }
            if (typeof username !== 'string' || typeof password !== 'string') {
                throw new Error('用户名和密码必须是字符串');
            }

            // 输入用户名和密码
            console.log('输入登录信息...');
            await usernameInput.click();
            await page.waitForTimeout(500);
            await usernameInput.type(username, { delay: 100 });

            await passwordInput.click();
            await page.waitForTimeout(500);
            await passwordInput.type(password, { delay: 100 });

            // 查找登录按钮
            console.log('查找登录按钮...');
            const loginButtonSelectors = [
                'button[name="authorLogin"]',  // Author Login 按钮
                'input[name="authorLogin"]',
                'button[type="submit"]',
                'input[type="submit"]',
                'button[name*="Login" i]',
                'input[value*="Login" i]'
            ];

            let loginButton = null;
            let loginButtonSelector = null;
            for (const selector of loginButtonSelectors) {
                try {
                    loginButton = await loginFrame.$(selector);
                    if (loginButton) {
                        console.log(`✓ 找到登录按钮: ${selector}`);
                        loginButtonSelector = selector;
                        break;
                    }
                } catch (e) {
                    // 继续尝试
                }
            }

            if (!loginButton) {
                throw new Error('无法找到登录按钮');
            }

            // 点击登录按钮（使用 evaluate 方法以避免 "not clickable" 错误）
            console.log('点击登录按钮...');

            // 设置导航监听
            const navigationPromise = page.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 10000
            }).catch(() => null);

            // 点击登录按钮
            await loginFrame.evaluate((selector) => {
                const button = document.querySelector(selector);
                if (button) {
                    button.click();
                }
            }, loginButtonSelector);

            // 等待导航或超时
            await navigationPromise;
            await page.waitForTimeout(3000);

            // 检查当前URL
            let currentUrl = page.url();
            console.log('点击后URL:', currentUrl);

            // 如果还在登录页面且有错误参数，说明登录失败
            if (currentUrl.includes('loginError=1')) {
                throw new Error('登录失败！用户名或密码错误，请检查您的凭据');
            }

            // 如果已经成功跳转到default2.aspx，说明登录成功
            if (currentUrl.includes('default2.aspx')) {
                console.log('✓ 登录成功！已自动跳转到主菜单');
            }
            // 如果还在Default.aspx但没有错误，可能需要手动导航
            else if (currentUrl.includes('Default.aspx')) {
                console.log('注意：页面未自动跳转，尝试直接访问主菜单...');
                try {
                    await page.goto('https://www.editorialmanager.com/jolt/default2.aspx', {
                        waitUntil: 'networkidle2',
                        timeout: 15000
                    });
                    await page.waitForTimeout(2000);
                    currentUrl = page.url();
                    console.log('导航后URL:', currentUrl);

                    // 再次验证是否成功
                    if (currentUrl.includes('Default.aspx') && !currentUrl.includes('default2')) {
                        throw new Error('无法访问主菜单，可能是登录session未建立');
                    }
                } catch (e) {
                    console.log('导航到主菜单失败:', e.message);
                    throw new Error('登录后无法访问主菜单: ' + e.message);
                }
            }

            // 最终验证 - 检查是否真的登录了
            const isLoggedIn = await page.evaluate(() => {
                const getIsLoggedIn = (doc) => {
                    // 检查是否有退出链接或特定的登录文本
                    const logoutBtn = doc.querySelector('a[href*="logout" i]');
                    const logoutText = Array.from(doc.querySelectorAll('a, span, div'))
                        .find(el => /Logout|退出|Sign Out/i.test(el.textContent));
                    return !!(logoutBtn || logoutText);
                };

                if (getIsLoggedIn(document)) return true;

                // 检查所有 iframe
                const iframes = Array.from(document.querySelectorAll('iframe'));
                for (const iframe of iframes) {
                    try {
                        if (iframe.contentDocument && getIsLoggedIn(iframe.contentDocument)) {
                            return true;
                        }
                    } catch (e) { }
                }
                return false;
            });

            if (!isLoggedIn) {
                // 如果 evaluate 失败，打印控制台内容辅助调试
                console.log('登录验证失败，尝试在页面文本中查找 "Logout"...');
                const pageText = await page.evaluate(() => document.body.innerText);
                if (!pageText.includes('Logout')) {
                    throw new Error('登录验证失败：页面上未找到登录标志（Logout链接或文本）');
                }
            }

            console.log('✓ 登录验证通过！');

            // 保存登录后的主菜单页面截图
            try {
                await page.waitForTimeout(5000); // 给更多时间让 frame 加载
                await page.screenshot({ path: 'data/main_menu.png', fullPage: true });
                console.log('已保存主菜单页面截图到 data/main_menu.png');
            } catch (e) {
                console.log('无法保存截图:', e.message);
            }

            // 获取所有 frame 并打印信息辅助调试
            const framesAfterLogin = page.frames();
            console.log(`登录后页面共有 ${framesAfterLogin.length} 个 frame:`);
            framesAfterLogin.forEach((f, i) => {
                console.log(`  Frame ${i}: name="${f.name()}", url="${f.url()}"`);
            });

            // 点击 "Revisions Being Processed" 链接
            console.log('查找并点击 "Revisions Being Processed" 链接...');

            let revisionsLink = null;

            // 尝试多次搜索，因为 frame 可能动态加载
            for (let attempt = 0; attempt < 3; attempt++) {
                for (const frame of page.frames()) {
                    try {
                        revisionsLink = await frame.evaluate(() => {
                            const links = Array.from(document.querySelectorAll('a'));
                            const targetLink = links.find(link => {
                                const text = link.textContent.trim();
                                return /Revisions\s+Being\s+Processed/i.test(text);
                            });

                            if (targetLink) {
                                return {
                                    href: targetLink.href,
                                    text: targetLink.textContent.trim()
                                };
                            }
                            return null;
                        });
                        if (revisionsLink) {
                            console.log(`✓ 在 frame "${frame.name()}" (${frame.url()}) 中找到链接: ${revisionsLink.text}`);
                            break;
                        }
                    } catch (e) {
                        // 忽略 evaluate 错误
                    }
                }
                if (revisionsLink) break;
                console.log(`第 ${attempt + 1} 次查找链接未果，等待 2 秒...`);
                await page.waitForTimeout(2000);
            }

            if (!revisionsLink) {
                console.log('⚠️  未找到 "Revisions Being Processed" 链接，尝试查找 "Submissions Being Processed"...');

                for (const frame of page.frames()) {
                    try {
                        const submissionsLink = await frame.evaluate(() => {
                            const links = Array.from(document.querySelectorAll('a'));
                            const targetLink = links.find(link => {
                                const text = link.textContent.trim();
                                return /Submissions\s+Being\s+Processed/i.test(text);
                            });
                            if (targetLink) {
                                return {
                                    href: targetLink.href,
                                    text: targetLink.textContent.trim()
                                };
                            }
                            return null;
                        });

                        if (submissionsLink) {
                            revisionsLink = submissionsLink;
                            console.log(`✓ 在 frame "${frame.name()}" 中找到链接: ${submissionsLink.text}`);
                            break;
                        }
                    } catch (e) {
                        // 忽略错误
                    }
                }
            }

            if (revisionsLink) {
                console.log(`正在从链接导航: ${revisionsLink.href}`);
                try {
                    await page.goto(revisionsLink.href, {
                        waitUntil: 'networkidle2',
                        timeout: 25000
                    });
                    console.log('✓ 成功进入稿件管理页面');
                } catch (e) {
                    console.log('导航失败，尝试在当前页面提取...', e.message);
                }
            } else {
                console.log('未找到任何处理中的稿件链接，尝试在所有 frame 中查找当前页面是否包含稿件列表...');
            }

            await page.waitForTimeout(3000);

            // 保存最终页面截图
            try {
                await page.screenshot({ path: 'data/revisions_page.png', fullPage: true });
                console.log('已保存稿件页面截图到 data/revisions_page.png');
            } catch (e) { }

            // 提取稿件信息 - 遍历所有 frame
            console.log('开始提取稿件信息...');
            let allManuscripts = [];

            for (const frame of page.frames()) {
                try {
                    const frameManuscripts = await frame.evaluate(() => {
                        const results = [];
                        const tables = Array.from(document.querySelectorAll('table'));

                        for (const table of tables) {
                            const rows = Array.from(table.querySelectorAll('tr'));
                            let manuscriptNumCol = -1;
                            let titleCol = -1;
                            let statusCol = -1;

                            // 查找表头
                            for (let i = 0; i < rows.length; i++) {
                                const row = rows[i];
                                const headers = Array.from(row.querySelectorAll('th, td.header, td.tableheader'));
                                if (headers.length > 0) {
                                    headers.forEach((th, index) => {
                                        const text = th.textContent.trim();
                                        if (/Manuscript.*Number/i.test(text)) manuscriptNumCol = index;
                                        else if (/Title/i.test(text)) titleCol = index;
                                        else if (/Current.*Status|Status.*Date/i.test(text)) statusCol = index;
                                    });
                                    if (manuscriptNumCol !== -1 || statusCol !== -1) break;
                                }
                            }

                            // 如果找到表头或至少有表格
                            rows.forEach(row => {
                                const cells = Array.from(row.querySelectorAll('td'));
                                if (cells.length >= 2) {
                                    let manuscriptId = '';
                                    let title = '';
                                    let status = '';

                                    if (manuscriptNumCol >= 0 && manuscriptNumCol < cells.length) manuscriptId = cells[manuscriptNumCol].textContent.trim();
                                    if (titleCol >= 0 && titleCol < cells.length) title = cells[titleCol].textContent.trim();
                                    if (statusCol >= 0 && statusCol < cells.length) status = cells[statusCol].textContent.trim();

                                    // 智能匹配
                                    if (!manuscriptId || !status) {
                                        const texts = cells.map(c => c.textContent.trim());
                                        const idMatch = texts.find(t => /[A-Z]+-D-\d+-\d+R?\d*/i.test(t));
                                        const statusMatch = texts.find(t => /Under Review|With Editor|Decision|Revision|Submitted|Accept|Reject/i.test(t));

                                        if (idMatch) manuscriptId = idMatch;
                                        if (statusMatch) status = statusMatch;

                                        if (!title) {
                                            const longText = texts.find(t => t.length > 20 && t !== status && t !== manuscriptId);
                                            if (longText) title = longText;
                                        }
                                    }

                                    if (manuscriptId && status && !/Manuscript.*Number|Current.*Status/i.test(manuscriptId)) {
                                        results.push({
                                            manuscriptId,
                                            title: title || 'N/A',
                                            status,
                                            lastUpdate: new Date().toISOString()
                                        });
                                    }
                                }
                            });
                        }
                        return results;
                    });

                    if (frameManuscripts && frameManuscripts.length > 0) {
                        allManuscripts = allManuscripts.concat(frameManuscripts);
                    }
                } catch (e) { }
            }

            // 去重
            const uniqueManuscripts = [];
            const seenIds = new Set();
            for (const ms of allManuscripts) {
                if (!seenIds.has(ms.manuscriptId)) {
                    seenIds.add(ms.manuscriptId);
                    uniqueManuscripts.push(ms);
                }
            }

            console.log(`✓ 找到 ${uniqueManuscripts.length} 篇唯一稿件`);

            if (uniqueManuscripts.length > 0) {
                uniqueManuscripts.forEach((ms, i) => console.log(`  ${i + 1}. ${ms.manuscriptId} - ${ms.status}`));
            } else if (allManuscripts.length === 0) {
                console.log('未找到任何稿件，检查页面文字...');
                const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
                console.log('页面开头文字:', pageText);
            }

            return {
                success: true,
                timestamp: new Date().toISOString(),
                manuscriptCount: uniqueManuscripts.length,
                manuscripts: uniqueManuscripts
            };

        } catch (error) {
            console.error('监控出错:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

module.exports = new MonitorService();
