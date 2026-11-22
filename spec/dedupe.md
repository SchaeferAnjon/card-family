# 判重

## 判重键（`dedupeKey`）

两个问题是不是同一个：都转成小写，再去掉所有空白和标点，剩下的一样就是同一个。

按 Unicode 码位逐个看：

- 小写：Unicode 默认的小写映射（Swift `lowercased()`、JavaScript `toLowerCase()`）。
- 空白：Unicode 属性 White_Space。
- 标点：Unicode 一般类别 P（Pc、Pd、Ps、Pe、Pi、Pf、Po）。`+ $ ^ = < >` 这类是符号（类别 S），留着。

例：`Git 怎么撤销上一次提交？` 和 `git怎么撤销上一次提交` 是同一个，键都是 `git怎么撤销上一次提交`。

## 两种判重办法

送一批卡时选一种（`addNotes` 的 `dedupe` 参数）：

### 按问题（`question`）

ChatCards、GetNewWord、画布笔记用。适合问题各不相同的卡。

1. 同一批里，牌组相同、判重键相同的只送第一张，后面的记成重复。
2. 剩下的交给 Anki 判：笔记的 `options` 是 `{"allowDuplicate": false, "duplicateScope": "deck"}`，Anki 按第一个字段 `Question` 在同一个牌组里找。先用 `canAddNotesWithErrorDetail` 问一遍，回 `canAdd: false` 且错误里带 `duplicate` 的记成重复，别的错误记成失败，能加的再用 `addNotes` 一次加。

### 按编号（`id`）

Ask Free 用。适合问法常常一样的卡（「这是什么意思？」每次问的是不同的屏幕）。

1. 每张卡用 `findNotes` 查 `"ID:<编号>"`，找到了记成重复。
2. 没找到的用 `addNotes` 加，`options` 是 `{"allowDuplicate": true}`，不让 Anki 按问题判。

## 在 Anki 里找卡

卡片浏览器里只看这几张：`"ID:a" OR "ID:b"`（`idQuery`）。编号只用字母、数字、`-` 和 `_`，不用转义。
