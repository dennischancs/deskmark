# 桌笺（Deskmark）

桌笺是 [MarkText](https://github.com/marktext/marktext) 的分叉。底座是 MarkText v0.20.0，许可证是 MIT。即时排版、源码模式、主题、导出和 Windows、macOS、Linux 安装包沿用那一版，渲染没有重写。

桌笺自己加上的是三件用在眼前这几篇笔记上的事：待办、桌面便签、简单月历。待办和日期写在原来的 Markdown 里，不另抄一份。不做成知识库，也不做成另一套待办软件。

源码在 <https://github.com/dennischancs/marktext>。这不是 MarkText 官方仓库，安装包也不从 [marktext/marktext 的发布页](https://github.com/marktext/marktext/releases)、Homebrew、Chocolatey 或 Winget 里拿。那些装到的是上游的 MarkText。

## 桌笺加上的

### 待办

打开一个文件夹之后，桌笺从这一层开始，一层层往下看。文件很多也按这个办法走，包括十七万个文件的目录，例如「下载」。`.git`、`node_modules` 和 `.deskmark` 这几个目录跳过。

只读纯文本。默认就是这个编辑器本来就能打开的扩展名：`.markdown`、`.mdown`、`.mkdn`、`.md`、`.mkd`、`.mdwn`、`.mdtxt`、`.mdtext`、`.mdx`、`.text`、`.txt`。设置里可以勾选，也可以自己输入别的扩展名，用逗号分开。

待办和日期仍写在原来的文件里。`.deskmark` 里的索引只是为了找得快，删掉以后会再长出来。

识别规则如下。前三条默认开着，后两条默认关着，都可以在「设置 - 桌笺」里改。

1. 一行是待办：行首可以有空格，然后是 `-`、`*` 或 `+`，接着 `[ ]` 或 `[x]`。写在一对三个反引号之间，或者写在一对 `~~~` 之间的代码不算。
2. 日期、提醒、优先级和重复写在这一行末尾：`<!-- deskmark: due=2026-10-07; remind=2026-10-07T09:00:00+08:00; priority=high; repeat=daily -->`。日期是 `YYYY-MM-DD`。提醒是带时区的时间。
3. 整篇是待办：文件开头写成下面这样。

    ```yaml
    ---
    title: 交表
    deskmark:
      kind: todo
      due: 2026-10-09
    ---
    ```

4. 可选。待办文字里单独出现的 `YYYY-MM-DD` 也当作日期。默认关掉，避免把无关的数字当成日期。
5. 可选。额外的行开头，例如 `TODO:` 或 `待办:`。在设置里输入，用逗号分开。代码块里的仍然不算。

文件很多时，不在窗口那条线程里读完。另开一条线程一层层往下看，读纯文本、抽出待办，再一小批一小批写进索引。窗口同时还能打字、切换文件。先比较修改时间，没改过的文件不再读内容。待办列表上的数字是已经点过的名字个数，所以下载文件夹里大量图片时数字也会往前走；大约每秒才把整份待办重画一次。单个文件超过 2MB 就跳过。侧栏的文件列表也是分批放上去的，打开文件夹时不会把每一篇都读进内存。

视图菜单里可以打开待办、新建一篇待办笔记，也可以看字数。

### 便签

把当前笔记贴到桌面上，成为一个小窗。它仍是那一篇笔记，不是另一套数据。可以改颜色、透明度和字号，也可以贴边收起。位置记在本地。

### 月历

月历上能看到哪一天有事。点开是当天的待办，也可以从某一天直接新建。到点会提醒。可以导出日历。没有周视图，也没有时间栅格。

## 沿用 MarkText、没有改写的功能

下面这些是 MarkText v0.20.0 里已有的能力。桌笺没有换编辑器，也没有做第二套即时排版。更细的用法仍写在仓库里的用户文档：[packages/website/content/docs](packages/website/content/docs/README.md)。

### 写作和界面

- 即时排版。语法写下之后就显示成排好的样子，不另开一个预览窗。
- 源码模式、打字机模式、专注模式。
- 侧边栏里有文件夹树、已打开的文件、文件夹内搜索和当前文章目录。
- 多标签。标签可以拖动排序，也可以藏起来再用快捷键切换。
- 命令面板，以及在已打开文件夹里快速打开文件。
- 窗口可以缩放、全屏、置顶。
- 界面跟随系统语言，缺的句子回退到英文。
- 浅色和深色主题，也可以跟随系统切换。浅色：Ayu Light、Cadmium Light、Catppuccin Latte、Everforest Light、Graphite、Gruvbox Light、Rosé Pine Dawn、Solarized Light、Tokyo Night Light、Ulysses Light。深色：Ayu Dark、Ayu Mirage、Cadmium Dark、Catppuccin Mocha、Cyberdream、Dracula、Everforest Dark、Gruvbox Dark、Horizon Dark、Kanagawa、Material Dark、Monokai Pro、Nightfox、Nord、One Dark、Oxocarbon Dark、Palenight、Rosé Pine、Rosé Pine Moon、Solarized Dark、SynthWave '84、Tokyo Night、Tokyo Night Storm。

### Markdown

语法以 [CommonMark](https://spec.commonmark.org) 和 [GitHub Flavored Markdown](https://github.github.com/gfm/) 为准，并有选择地支持 [Pandoc Markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)。编辑器里可以直接插入或排版这些块：

- 六级标题，以及标题升级、降级。
- 段落、换行、分隔线。
- 粗体、斜体、删除线、下划线、上标、下标、高亮、行内代码。
- 链接、自动链接、链接标题。
- 图片。可以从剪贴板直接粘贴，也可以在查看器里改大小和对齐（行内、靠左、居中、靠右）。图片可以留在本地相对路径或绝对路径。上传走 PicGo 或一条自己的命令行脚本。
- 引用。
- 无序列表、有序列表、任务列表，以及松散列表项。
- 表格，包括对齐，以及拖动一行或一列来重排。
- 围栏代码块和缩进代码块，用 Prism 做语法高亮。
- 键盘按键、表情。
- 文前信息：YAML、TOML、JSON。
- 行内公式和公式块，用 KaTeX，也接受 TeX 分隔符。
- 图：Mermaid 的流程图、时序图、甘特图和实验性的类图；flowchart.js；PlantUML；Vega-Lite。
- 原始 HTML。

选中文字时会出现格式条。段落和行内样式有快捷键。括号和引号会自动补全。

### 文件、查找、导出

- 打开文件、打开文件夹、最近打开、保存、另存为、自动保存、移动、重命名。
- 打开时判断编码和 BOM，默认 UTF-8。也能判断并切换换行是 CRLF 还是 LF。
- 在当前文里查找和替换。在已打开的文件夹里按词搜索，可以忽略大小写，也可以用正则。
- 导出 HTML 和 PDF，也可以打印。PDF 和打印可以设纸张、方向、页边距、字体、标题自动编号、是否印出文前信息，以及页眉页脚。导出用的页面主题和编辑主题是分开的。
- 机器上另行安装了 [Pandoc](https://pandoc.org/) 时，可以再转成 Word、OpenDocument、RTF、EPUB、LaTeX、reStructuredText、Org、MediaWiki、Textile。Pandoc 不随桌笺分发，它是用户自己安装的程序。
- 系统拼写检查，可以关掉。
- 命令行可以带文件或文件夹启动。便携方式是把程序和数据放在一起跑，见 [便携模式说明](packages/website/content/docs/end-user/PORTABLE.md)。

## 开发

需要 Node.js 20.19.0 或更高，以及 pnpm 10 或更高。命令在仓库根目录执行。

```bash
pnpm install
pnpm run dev
```

Windows、macOS 和 Linux 用同一条命令清理和打包。入口是 `scripts/deskmark.mjs`，具体删哪些目录、调用哪条打包命令在 `scripts/workspace.ts`。

```bash
node scripts/deskmark.mjs clean
node scripts/deskmark.mjs build
node scripts/deskmark.mjs rebuild
```

- `clean`：删掉这次编译的中间文件、解包目录、测试输出和调试日志。已经打好的安装包留在 `dist/`。`node_modules` 不动。
- `build`：按当前系统打安装包。Windows 普通机器打 x64，ARM 机器打 arm64。macOS 和 Linux 只能在各自的系统上打，不能在 Windows 上代打。
- `rebuild`：先做上面的清理，再打安装包。

```bash
node scripts/deskmark.mjs clean --installers
node scripts/deskmark.mjs build --unpack
node scripts/deskmark.mjs --help
```

- `--installers`：连 `dist/` 里已有的安装包一起删。只能跟 `clean` 或 `rebuild`。
- `--unpack`：只编译，不打安装包。只能跟 `build` 或 `rebuild`。

`pnpm run clean`、`pnpm run build:release` 和 `pnpm run rebuild` 是上面三条命令的别名。`pnpm run build` 只编译、不打安装包，和 `build --unpack` 相同。

检查：

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

编辑器文档在 [packages/website/content/docs](packages/website/content/docs/README.md)。开发说明的入口是 [packages/website/content/docs/dev/README.md](packages/website/content/docs/dev/README.md)。

## 许可证

本仓库的程序以 [MIT](LICENSE) 分发。版权声明仍是上游的：

- Copyright (c) 2017-present Luo Ran
- Copyright (c) 2018-present MarkText Contributors

桌笺是在这份软件上的修改。MIT 要求保留上面的版权声明和许可声明。

## 用到的开源代码

桌笺没有把 Notepad++、Notepad4、Typora、Joplin、Logseq 或 Notion 的代码拿进来。那些只在产品说明里当过行为参考。

真正进到程序里的是 MarkText 这一份源码，加上下面这些直接依赖。版本是当前锁定并安装的版本，许可证抄自各包自己的 `package.json`。传递依赖没有展开。构建和测试才用到的 TypeScript、ESLint、Vitest、Playwright、electron-builder 也不在这张表里。需要随安装包分发的完整第三方声明时，在仓库根目录运行 `pnpm run gen-third-party`，输出在 `packages/desktop/build/THIRD-PARTY-LICENSES.txt`。

另外有一处直接抄来的小段代码：`packages/desktop/src/main/utils/pandoc.ts` 开头写明抄自 <https://github.com/utatti/simple-pandoc/blob/master/index.js>。写这份说明时，那个仓库已经打不开，所以这里不替它填写许可证。

| 包 | 版本 | 许可证 | 说明 |
| --- | --- | --- | --- |
| [MarkText](https://github.com/marktext/marktext) | v0.20.0 分叉 | MIT | 本仓库的程序底座 |
| [@electron-toolkit/preload](https://github.com/alex8088/electron-toolkit) | 3.0.2 | MIT | 直接依赖 |
| [@electron-toolkit/utils](https://github.com/alex8088/electron-toolkit) | 4.0.0 | MIT | 直接依赖 |
| [@element-plus/icons-vue](https://github.com/element-plus/element-plus-icons) | 2.3.2 | MIT | 直接依赖 |
| [@floating-ui/dom](https://github.com/floating-ui/floating-ui) | 1.7.6 | MIT | 直接依赖 |
| [@hfelix/electron-localshortcut](https://github.com/fxha/electron-localshortcut) | 4.0.1 | MIT | 直接依赖 |
| [@intlify/core-base](https://github.com/intlify/vue-i18n) | 11.4.6 | MIT | 直接依赖 |
| [@marktext/file-icons](https://github.com/marktext/file-icons) | 1.0.6 | MIT | 直接依赖 |
| [@muyajs/core](https://github.com/marktext/muya) | 0.2.0 | MIT | 本仓库 `packages/muya`，上游是 marktext/muya |
| [@popperjs/core](https://github.com/popperjs/popper-core) | 2.11.8 | MIT | 直接依赖 |
| [@vscode/ripgrep](https://github.com/microsoft/vscode-ripgrep) | 1.18.0 | MIT | 直接依赖 |
| [arg](https://github.com/vercel/arg) | 5.0.2 | MIT | 直接依赖 |
| [axios](https://github.com/axios/axios) | 1.18.0 | MIT | 直接依赖 |
| [ced](https://github.com/sonicdoe/ced) | 2.0.0 | ISC AND Apache-2.0 | 直接依赖 |
| [chokidar](https://github.com/paulmillr/chokidar) | 5.0.0 | MIT | 直接依赖 |
| [CodeMirror 5](https://github.com/codemirror/CodeMirror) | 5.65.21 | MIT | 源码模式 |
| [command-exists](https://github.com/mathisonian/command-exists) | 1.2.9 | MIT | 直接依赖 |
| [deep-equal](https://github.com/inspect-js/node-deep-equal) | 2.2.3 | MIT | 直接依赖 |
| [dom-autoscroller](https://github.com/hollowdoor/dom_autoscroller) | 2.3.4 | MIT | 直接依赖 |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.11 | MPL-2.0 OR Apache-2.0 | 直接依赖 |
| [dragula](https://github.com/bevacqua/dragula) | 3.7.3 | MIT | 直接依赖 |
| [Electron](https://github.com/electron/electron) | 42.1.0 | MIT | 桌面壳。开发依赖，打进应用 |
| [electron-log](https://github.com/megahertz/electron-log) | 5.4.4 | MIT | 直接依赖 |
| [electron-store](https://github.com/sindresorhus/electron-store) | 11.0.2 | MIT | 直接依赖 |
| [electron-updater](https://github.com/electron-userland/electron-builder) | 6.8.9 | MIT | 直接依赖 |
| [electron-window-state](https://github.com/mawie81/electron-window-state) | 5.0.3 | MIT | 直接依赖 |
| [Element Plus](https://github.com/element-plus/element-plus) | 2.14.2 | MIT | 直接依赖 |
| [element-resize-detector](https://github.com/wnr/element-resize-detector) | 1.2.4 | MIT | 直接依赖 |
| [fast-diff](https://github.com/jhchen/fast-diff) | 1.3.0 | Apache-2.0 | 直接依赖 |
| [flowchart.js](https://github.com/adrai/flowchart.js) | 1.18.0 | MIT | 流程图 |
| [font-list](https://github.com/oldj/node-font-list) | 2.1.0 | MIT | 直接依赖 |
| [fs-extra](https://github.com/jprichardson/node-fs-extra) | 11.3.5 | MIT | 直接依赖 |
| [Fuse.js](https://github.com/krisk/Fuse) | 7.4.2 | Apache-2.0 | 直接依赖 |
| [fuzzaldrin](https://github.com/atom/fuzzaldrin) | 2.1.0 | MIT | 直接依赖 |
| [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) | 5.9.0 | MIT | 直接依赖 |
| [html-tags](https://github.com/sindresorhus/html-tags) | 5.1.0 | MIT | 直接依赖 |
| [iso-639-1](https://github.com/meikidd/iso-639-1) | 3.1.5 | MIT | 直接依赖 |
| [joplin-turndown-plugin-gfm](https://github.com/laurent22/joplin-turndown-plugin-gfm) | 1.0.12 | MIT | 直接依赖 |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.17.0 | MIT | 公式 |
| [keytar](https://github.com/atom/node-keytar) | 7.9.0 | MIT | 直接依赖 |
| [lodash](https://github.com/lodash/lodash) | 4.18.1 | MIT | 直接依赖 |
| [marked](https://github.com/markedjs/marked) | 18.0.5 | MIT | Markdown 解析 |
| [marked-highlight](https://github.com/markedjs/marked-highlight) | 2.2.4 | MIT | 直接依赖 |
| [Mermaid](https://github.com/mermaid-js/mermaid) | 11.15.0 | MIT | 图 |
| [minimatch](https://github.com/isaacs/minimatch) | 9.0.9 | ISC | 直接依赖 |
| [mitt](https://github.com/developit/mitt) | 3.0.1 | MIT | 直接依赖 |
| [ms](https://github.com/vercel/ms) | 2.1.3 | MIT | 直接依赖 |
| [native-keymap](https://github.com/Microsoft/node-native-keymap) | 3.3.9 | MIT | 可选依赖 |
| [ot-json1](https://github.com/josephg/json1) | 1.0.2 | ISC | 直接依赖 |
| [ot-text-unicode](https://github.com/ottypes/text) | 4.0.0 | ISC | 直接依赖 |
| [pako](https://github.com/nodeca/pako) | 2.1.0 | MIT AND Zlib | 直接依赖 |
| [pathe](https://github.com/unjs/pathe) | 2.0.3 | MIT | 直接依赖 |
| [Pinia](https://github.com/vuejs/pinia) | 3.0.4 | MIT | 直接依赖 |
| [plantuml-encoder](https://github.com/markushedvall/plantuml-encoder) | 1.4.0 | MIT | PlantUML 编码。PlantUML 渲染服务不在此包里 |
| [plist](https://github.com/TooTallNate/plist.js) | 5.0.0 | MIT | 直接依赖 |
| [Prism](https://github.com/PrismJS/prism) | 1.30.0 | MIT | 代码高亮 |
| [RxJS](https://github.com/reactivex/rxjs) | 7.8.2 | Apache-2.0 | 直接依赖 |
| [snabbdom](https://github.com/snabbdom/snabbdom) | 3.6.4 | MIT | 直接依赖 |
| [snabbdom-to-html](https://github.com/acstll/snabbdom-to-html) | 7.1.0 | MIT | 直接依赖 |
| [snapsvg-cjs](https://github.com/geelen/Snap.svg-cjs) | 0.0.6 | MIT | 直接依赖 |
| [Turndown](https://github.com/mixmark-io/turndown) | 7.2.4 | MIT | 直接依赖 |
| [Underscore](https://github.com/jashkenas/underscore) | 1.13.8 | MIT | 直接依赖 |
| [Vega](https://github.com/vega/vega) | 6.2.0 | BSD-3-Clause | Vega-Lite 图 |
| [vega-embed](https://github.com/vega/vega-embed) | 7.1.0 | BSD-3-Clause | 直接依赖 |
| [Vega-Lite](https://github.com/vega/vega-lite) | 6.4.3 | BSD-3-Clause | 直接依赖 |
| [Vue](https://github.com/vuejs/core) | 3.5.38 | MIT | 界面。开发依赖，打进渲染进程 |
| [vue-i18n](https://github.com/intlify/vue-i18n) | 11.4.6 | MIT | 直接依赖 |
| [Vue Router](https://github.com/vuejs/router) | 4.6.4 | MIT | 直接依赖 |
| [webfontloader](https://github.com/typekit/webfontloader) | 1.6.28 | Apache-2.0 | 直接依赖 |
| [write-file-atomic](https://github.com/npm/write-file-atomic) | 7.0.1 | ISC | 直接依赖 |
