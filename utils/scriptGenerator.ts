const generateNodeScript = (): string => {
    return `// Node.js 脚本，用于从 Linux.Do 下载并处理公开数据
// =================================================================
// **终极方案**: 本脚本使用 'puppeteer' 启动一个无头浏览器来抓取数据，
// 这能最可靠地绕过网站安全防护 (Cloudflare)。
//
// 如何运行:
// 1. 确保您已安装 Node.js (https://nodejs.org/)。
// 2. 将此脚本保存到电脑上一个 **新的空文件夹** 中，文件名为 get_linuxdo_data.js。
// 3. 打开您的终端 (Terminal / PowerShell / CMD)。
// 4. 使用 'cd' 命令进入您保存脚本的文件夹。
// 5. 运行此命令安装所需库: npm install puppeteer turndown
// 6. 注意：此命令会下载一个浏览器 (约数百MB)，首次安装可能需要几分钟，请耐心等待。
// 7. 运行此命令开始获取数据: node get_linuxdo_data.js
// 8. 脚本会提示您输入要分析的 Linux.Do 用户名和要抓取的页面数。
// =================================================================

const fs = require('fs');
const readline = require('readline');
let puppeteer;
let TurndownService;

// 检查 puppeteer 是否已安装
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.error("❌ 错误：必需的 'puppeteer' 库未找到。");
    console.error("请先在您的终端中运行 'npm install puppeteer' 来安装它。");
    console.error("注意：首次安装会下载一个浏览器，可能需要几分钟时间。");
    process.exit(1);
}

// 检查 turndown 是否已安装
try {
    TurndownService = require('turndown');
} catch (e) {
    console.error("❌ 错误：必需的 'turndown' 库未找到。");
    console.error("请先在您的终端中运行 'npm install turndown' 来安装它。");
    process.exit(1);
}

const BASE_URL = "https://linux.do";

// 设置一个真实的 User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * 使用 Puppeteer (无头浏览器) 获取并解析 JSON 数据。
 * @param {import('puppeteer').Page} page - Puppeteer 页面实例.
 * @param {string} urlToFetch - 要获取的 URL.
 * @returns {Promise<object>} - 解析后的 JSON 对象.
 */
async function fetchJsonWithPuppeteer(page, urlToFetch) {
    console.log(\`  - 正在通过浏览器访问: \${urlToFetch}\`);
    try {
        const response = await page.goto(urlToFetch, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        if (!response.ok()) {
            if (response.status() === 404) {
                 throw new Error(\`请求失败 (404 Not Found)。请检查用户名或URL是否正确。\`);
            }
            throw new Error(\`请求失败，服务器返回状态: \${response.status()} \${response.statusText()}\`);
        }

        // Linux.Do 的 JSON API 响应会直接渲染在 <pre> 标签中
        const jsonText = await page.evaluate(() => {
            return document.querySelector('body > pre')?.innerText;
        });

        if (!jsonText) {
            throw new Error('页面加载成功，但未找到预期的 JSON 数据。网站结构可能已改变。');
        }

        return JSON.parse(jsonText);
    } catch (err) {
        // 重新包装错误以提供更多上下文
        throw new Error(\`访问 '\${urlToFetch}' 时出错: \${err.message}\`);
    }
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

    const USERNAME = (await askQuestion('请输入要分析的 Linux.Do 用户名: ')).trim();
    if (!USERNAME) {
        console.error("❌ 未输入用户名，脚本已退出。");
        rl.close();
        process.exit(1);
    }

    const pagesAnswer = await askQuestion('请输入要分析的动态页面数 (默认 5, 建议 5-10): ');
    let PAGES_TO_FETCH = parseInt(pagesAnswer, 10);
    if (isNaN(PAGES_TO_FETCH) || PAGES_TO_FETCH < 1) {
        console.log('⚠️ 输入无效或为空，将使用默认值 5 页。');
        PAGES_TO_FETCH = 5;
    }
    
    rl.close();
    
    const OUTPUT_FILENAME = \`analysis_data_\${USERNAME}.json\`;

    console.log(\`\n▶️  开始为用户 [\${USERNAME}] 下载公开数据...\`);
    console.log("🚀 使用无头浏览器模式，可以有效绕过网站防护。");
    console.log(\`ℹ️  将获取 \${PAGES_TO_FETCH} 页的动态 (发帖/回帖)，以及用户摘要信息。\`);
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    const turndownService = new TurndownService();

    try {
        const urlsToFetch = [];
        urlsToFetch.push({ type: 'summary', url: \`\${BASE_URL}/u/\${USERNAME}/summary.json\` });
        for (let i = 0; i < PAGES_TO_FETCH; i++) {
            const offset = i * 30;
            // filter=4(发帖), 5(回复) - 已移除点赞数据
            urlsToFetch.push({ type: 'actions', page: i, url: \`\${BASE_URL}/user_actions.json?offset=\${offset}&username=\${USERNAME}&filter=4,5\` });
        }

        console.log('⏳ 正在逐一获取所有数据，请稍候... (这可能需要一点时间)');
        
        let results = [];
        for (const item of urlsToFetch) {
             try {
                const data = await fetchJsonWithPuppeteer(page, item.url);
                results.push({ ...item, status: 'success', data });
             } catch (error) {
                results.push({ ...item, status: 'failed', reason: error.message });
             }
        }

        const failedRequests = results.filter(r => r.status === 'failed');
        if (failedRequests.length > 0) {
            failedRequests.forEach(r => console.error(\`❌ 获取 \${r.url} 失败: \${r.reason}\`));
            if(failedRequests.find(r => r.type === 'summary')) {
                throw new Error('获取核心的用户摘要数据失败，无法继续分析。');
            }
        }
        
        console.log('✅ 所有数据获取成功，正在处理...');

        const summaryResult = results.find(r => r.type === 'summary' && r.status === 'success');
        if (!summaryResult || !summaryResult.data) {
            throw new Error('未能获取用户摘要数据。请检查用户名是否正确，或该用户是否已隐藏其个人资料。');
        }

        const summaryData = summaryResult.data;
        let allActions = [];

        results
            .filter(r => r.type === 'actions' && r.status === 'success')
            .sort((a, b) => a.page - b.page)
            .forEach(r => {
                if (r.data && r.data.user_actions) {
                    allActions.push(...r.data.user_actions);
                }
            });
        
        console.log(\`📈 共找到 \${allActions.length} 条有效动态。正在精简数据以优化分析...\`);

        const finalData = {
            username: USERNAME,
            summaryData: summaryData,
            // 我们只选择每个活动中最核心的字段（如活动类型、标题、内容摘要），以减小整体数据体积。
            // 这样做可以在不丢失关键上下文的情况下，提升AI请求的效率和速度，并降低成本。
            // AI提示词已被优化，可通过这些精简后的关键字段来准确理解用户行为。
            actionsData: allActions.map(action => ({
                action_type: action.action_type,
                created_at: action.created_at,
                title: action.title,
                // 将 excerpt 中的 HTML 转换为干净的 Markdown，以便 AI 更好地理解
                excerpt: turndownService.turndown(action.excerpt || ''),
                // 对于回复，记录回复对象
                target_username: action.target_username,
            }))
        };
        
        // 将最终数据压缩成单行 JSON 写入文件，以减小体积
        fs.writeFileSync(OUTPUT_FILENAME, JSON.stringify(finalData), 'utf8');
        
        console.log('\\n****************************************************************');
        console.log(\`✅ 成功！已将所有数据压缩并保存到 '\${OUTPUT_FILENAME}' 文件中。\`);
        console.log('请回到浏览器，将此文件上传到分析工具中。');
        console.log('****************************************************************\\n');

    } catch (error) {
        console.error('\\n-----------------');
        console.error('❌ 脚本执行时发生严重错误:');
        console.error(error.message);
        console.error('\\n请检查：');
        console.error(\`  1. 您输入的用户名 (\\\`\${USERNAME}\\\`) 是否正确。\`);
        console.error('  2. 网络连接是否正常。');
        console.error('  3. 如果错误反复出现，请尝试减少“动态页面数”。');
        console.error('-----------------');
        process.exit(1);
    } finally {
        await browser.close();
        console.log("🚪 无头浏览器已关闭。");
    }
}

main();
`;
};


export const generateScript = (): { scriptContent: string, filename: string } => {
    return {
        scriptContent: generateNodeScript(),
        filename: `get_linuxdo_data.js`
    };
};