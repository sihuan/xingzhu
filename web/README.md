# 行箸 · Web 版

> 行于诗卷，箸点平仄 —— 古诗词平仄 / 韵脚赏析的**浏览器版本**，与 Android 版功能对齐，界面按桌面 / 网页设备重新布局。

零构建、无框架、纯静态：原生 ES Modules + IndexedDB，`python3 -m http.server` 即可运行。

## 运行

```bash
cd web
python3 -m http.server 8080      # 或：npm start / make web（在仓库根目录）
```

浏览器打开 <http://localhost:8080/>。

> 必须通过 HTTP 访问（不能直接双击 `index.html`）：应用需要 `fetch` 读取字典 / 语料 gzip，并依赖模块加载。

## 功能（与 Android 版对齐）

| 页面 | 说明 |
| --- | --- |
| **书架** `#/library` | 已收藏诗词卡片；6 种排序（添加时间新/旧、标题/作者首字母、朝代、体裁）+ 按作者分组折叠；点击进入阅读；删除前确认 |
| **添加诗词** `#/add` | 语料**全文搜索**（题目 / 作者 / 正文），300ms 防抖；标题/作者命中优先、正文命中在后，共取前 50；命中片段高亮、展开全诗、加入书架（已加入显示「已在书架」） |
| **阅读** `#/reader/:id` | 逐字**平仄**记号（〇/● 或 平/仄）、句末**韵脚**朱砂圈注 +《诗韵新编》韵部；标注说明；右侧**设置抽屉**（显示平仄 / 韵脚、记号样式、字号 18–34） |
| **习作检测** `#/check` | 粘贴自创新作，自动识别体裁（五/七言 绝/律），展示平仄韵脚并检测 **孤平 / 三平尾 / 三仄尾 / 失对 / 失粘 / 出韵**；问题句整行高亮 + 行首 ⚠ |

- 阅读设置持久化到 `localStorage`。
- 书架持久化到 **IndexedDB**（对应 Android 的 Room）。
- 首次打开自动把精选 10 首加入书架（对应 `ensureCorpusSeeded`）。

## PWA / 离线

首次访问时 Service Worker 会自动把**应用外壳 + 《诗韵新编》字典 + 全部语料（约 10MB）**缓存到本地（Cache Storage），页脚显示「可离线使用 ✓」。之后：

- 断网 / 飞行模式下仍可浏览书架、阅读、全文搜索、格律检测；
- 支持「添加到主屏幕 / 安装应用」（standalone 窗口，见 `manifest.webmanifest`）。

实现见 `sw.js`：外壳严格预缓存，字典与语料容错预缓存（个别失败不阻塞安装），运行时同源资源「缓存优先」，导航请求「网络优先 + 离线回退」。

> 修改前端文件后，请把 `sw.js` 里的 `VERSION` 递增（如 `xingzhu-v2`），浏览器才会更新缓存。

## 部署到 Cloudflare Pages

纯静态站点，Pages 免费套餐即可（单文件上限 25MiB，本仓库最大语料约 5MB）。

> ⚠️ 仓库里 `web/data/` 是指向 `app/`、`engine/` 的**符号链接**，构建时必须先执行 `web/tools/prepare-data.sh` 把语料 / 字典实体化，否则 Pages 产物里没有数据。

### 方式 A：连接 Git（推荐，推送即自动部署）

1. 先把含 `web` 分支的仓库推送到 GitHub。
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，授权并选择仓库。
3. **Production branch** 填 `web`（你推送的分支）。
4. 构建设置：
   - Framework preset：**None**
   - Build command：`bash web/tools/prepare-data.sh`
   - Build output directory：`web`
   - Root directory：留空（仓库根目录）
5. **Save and Deploy**，完成后访问 `https://<项目名>.pages.dev`。
6. 之后向 `web` 分支推送会自动重新构建部署。

### 方式 B：命令行直接上传（无需 Git 集成）

```bash
cd web
bash tools/prepare-data.sh
npx wrangler pages deploy . --project-name xingzhu --branch main
```

首次需按提示 `npx wrangler login`。`prepare-data.sh` 生成的是实体文件，不会把符号链接传上去。

### 说明

- Pages 默认 HTTPS，满足 Service Worker 的安全上下文要求；可绑定自定义域名（项目 → Custom domains）。
- `web/_headers` 已把 `/sw.js`、`/manifest.webmanifest` 设为 `no-cache`，保证版本更新及时生效。

## 数据

语料（7.6 万余首）与《诗韵新编》字典**直接复用仓库数据**，`web/data/` 下为符号链接：

```
web/data/corpus       -> ../../app/src/main/assets/corpus
web/data/kxhc1983.txt -> ../../engine/src/main/resources/kxhc1983.txt
web/data/rushu.txt    -> ../../engine/src/main/resources/rushu.txt
```

语料为 `.json.gz`，浏览器用 `DecompressionStream('gzip')` 解压（Chrome/Edge 80+、Firefox 113+、Safari 16.4+）。

**独立部署**（把 `web/` 单独拷走、或不支持符号链接的环境）：

```bash
bash web/tools/prepare-data.sh   # 复制实体数据到 web/data/（约 10MB）
```

## 目录结构

```
web/
├── index.html              应用外壳（顶部导航）
├── manifest.webmanifest    PWA 清单
├── sw.js                   Service Worker（离线缓存）
├── _headers                Cloudflare Pages 响应头
├── icons/                  PWA 图标（〇/● 平仄记号）
├── css/style.css           水墨宣纸「研墨」样式
├── js/
│   ├── main.js             启动 + hash 路由
│   ├── engine/             标注引擎（Kotlin :engine 的 JS 移植）
│   │   ├── model.js
│   │   ├── text-splitter.js
│   │   ├── dictionary.js
│   │   ├── pingze-engine.js
│   │   └── pingze-checker.js
│   ├── data/               语料 / 书架 / 设置
│   │   ├── corpus.js
│   │   ├── repository.js
│   │   ├── pinyin.js
│   │   └── settings.js
│   └── ui/                 视图与渲染
│       ├── dom.js
│       ├── annotated-poem-view.js
│       ├── library.js
│       ├── add.js
│       ├── reader.js
│       └── check.js
└── tools/
    ├── engine-test.mjs     引擎一致性测试（移植 Kotlin 单测）
    └── prepare-data.sh     实体化数据
```

## 引擎一致性测试

`js/engine/*` 与 Kotlin `:engine` 逐函数对应。移植用例见 `tools/engine-test.mjs`（文本切分、字典韵部 / 平仄 / 入声 / 多音、标注、文本清洗、格律检测）：

```bash
cd web && node tools/engine-test.mjs      # 或仓库根目录：make web-test
```

## 与 Android 版的差异

- 布局：桌面优先，书架为响应式网格、设置用右侧抽屉（Android 为单列列表 + BottomSheet）。
- 书架内过滤：Android 设计稿提及但实现未包含，Web 同样未做，保持一致。
- 阅读设置：Android 用 `rememberSaveable`（进程内），Web 持久化到 `localStorage`。
- 其余功能、文案、配色与判定结果与 Android 版一致。
