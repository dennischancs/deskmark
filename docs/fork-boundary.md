# 分叉边界

基线是 MarkText `v0.20.0`。上游远程名是 `upstream`。不把 `develop` 整支合并进来。渲染问题只拣选补丁，而且先看它碰不碰下面这些挂钩。

## 可以改

- `packages/deskmark-core/`、`packages/deskmark-index/`、`packages/deskmark-plugin/`
- `plugins/sample-wordcount/`
- `fixtures/deskmark/`
- `packages/desktop/` 里的挂钩：便签窗口、托盘、单实例、提醒、侧栏列表、日历界面、命令和视图注册、保存后通知索引
- `packages/muya` 只有两处例外，而且都不改绘制：任务元数据如果往返失败，只给列表项加一个可选字段；阶段 5 在现有快速插入上加菜单和 `@`

## 不要改

- 不要重写即时模式，也不要换成另一套编辑器
- 便签不要另做渲染。小窗加载同一套编辑器，只隐藏菜单和侧栏
- 不要把 `Muya.use()`、Node、宿主 DOM 或 shell 交给第三方插件
- 不要把 GPL 或 AGPL 项目整目录合并进来

## 探针

探针 A 在 0.3.0 跑过。加载、勾选、改字、源码模式来回之后，front matter 和行尾注释都还在。不需要改引擎。源码模式使用 `setContent`，会清空撤销历史，撤销退不回改字之前。这是上游行为，不是元数据丢失。

探针 B 在 0.4.0。`DESKMARK_PROBE_B=1` 时从主窗口再开一扇不透明无框窗口，调用 `setAlwaysOnTop`，复用编辑器，把矩形写到 `probe-b-bounds.json`。矩形恢复有单元测试。这次的机器是 Windows。macOS、Ubuntu X11、GNOME Wayland 还没有打开过这扇窗。Wayland 失败只记录，不换框架。

## 三平台构建

同一条命令在三个系统上都能用：`pnpm run clean` 和 `pnpm run build:release`。实现在 `scripts/workspace.ts`。构建按当前系统调用 `packages/desktop/package.json` 里的 `build:win`、`build:win:arm64`、`build:mac` 或 `build:linux`。安装结果写到仓库根目录的 `dist/`。

`clean` 不删除已经打好的安装包，只去掉解包目录、编译中间文件和调试日志。要连安装包一起删，加上 `--installers`。

这台机器可以打 Windows x64。macOS 的 dmg 要在 macOS 上打，并且沿用上游的未签名状态。Linux 的 deb 和 AppImage 要在 Linux 上打。签名不挡住内部构建。
