# 7.13.0

小版本。文件夹搜索可以按待办条件筛选。

上一版是 7.12.0。分叉基线仍然是上游 MarkText v0.20.0。

这次改了：

- 搜索里可以写 `is:task`、`is:open`、`due:today`、`due:overdue`、`priority:high`。
- 这些条件查的是待办，不是把记号当正文去找。后面还可以跟上文字，用来缩小结果。
- 没有这些条件时，仍然搜索文件名和正文。

Windows x64 安装包是 dist/marktext-win-x64-7.13.0-setup.exe。解包程序文件版本是 7.13.0。macOS 和 Linux 没有打包。
