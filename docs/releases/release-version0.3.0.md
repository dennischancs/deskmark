# 0.3.0

小版本。探针 A 只观察引擎会不会丢掉待办元数据，没有改渲染。

基线仍是 MarkText v0.20.0。上一版是 0.2.0。

夹具在 fixtures/deskmark/roundtrip/with-metadata.md。脚本是 scripts/probes/probe-a.spec.ts。结果在 scripts/probes/probe-a-report.json。

四步之后的结论：

- 加载、勾选、改这一行的文字、再按源码模式来回写一遍，front matter 和不认识的 custom 键都还在。行尾的 deskmark 注释也还在，包括未知键 vendor。
- 勾选只把方括号从空格改成 x。
- 源码模式这一步会清空撤销历史。撤销之后文字停在改过的那一版。元数据没有因此丢掉。

所以这次不改 packages/muya。
