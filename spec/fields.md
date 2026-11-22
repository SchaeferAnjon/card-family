# 字段怎么填、标签

AI 出的卡是纯文字（偶尔带 `` `代码` `` 和 `**加粗**`），Anki 字段是 HTML。`studyCardFields` 照下面填九个字段。

## 文字转 HTML（`textHTML`）

1. `\r\n` 和 `\r` 都当成换行 `\n`。
2. 去掉首尾空白（Unicode White_Space）。
3. 转义 `&` `<` `>` `"`（`escapeHTML`）。
4. `` `一段` `` 换成 `<code>一段</code>`（反引号中间不能有换行和反引号）。
5. `**一段**` 换成 `<b>一段</b>`（中间不能有换行和星号）。
6. 换行换成 `<br>`。

公式、Markdown 列表这些不在这里。要它们的软件（Ask Free、画布笔记）用自己的渲染拼九个字段，再用 `checkFields` 核一下字段齐不齐、有没有多的。

## 补充（`pointsHTML`）

按换行分（`\r\n`、`\n`、`\r`、`\v`、`\f`、U+0085、U+2028、U+2029），每行去掉首尾空白，行首的 `- • · *` 和它后面的空白去掉，空行不算。两条以上写成 `<ul><li>…</li></ul>`，每条用 `textHTML`；一条或零条就整段 `textHTML`。

## 答案是几条要点（`numberedHTML`）

GetNewWord 的知识片段：两行以上写成 `<ol><li>…</li></ol>`，纸上是编号方块；一行就整段 `textHTML`。

## 九个字段

| 字段 | 怎么填 |
| --- | --- |
| Question | `textHTML(问题)` |
| Answer | `textHTML(答案)`，`answerStyle: "numbered"` 时 `numberedHTML(答案)` |
| More | `pointsHTML(补充)` |
| Quote | `textHTML(原文摘句)` |
| Image | 没有截图是空；有：`<img src="文件名">`，放在问题下面的加 `class="lead"`，给了宽度加 `width="N"`（四舍五入成整数）。文件名转义。 |
| Label | `escapeHTML("<软件> · <来源>")` |
| Source | `escapeHTML("<标题> · <日期>")`，日期写 `yyyy-MM-dd` |
| Link | `escapeHTML(地址)`，没有就空 |
| ID | 原样，`<软件前缀>-<编号>` |

各软件的 ID 前缀：`chatcards-`、`askfree-`、`gnw-snip-`、`canvasnotes-`。

## 标签

- 标签里不能有空格：`tagSafe` 去掉首尾空白，中间连续的空白换成一个 `_`。
- 每张卡带 `来自::<软件>`（`fromTag`）：`来自::ChatCards`、`来自::Ask_Free`、`来自::GetNewWord`、`来自::Canvas_Notes`。
- 主题写 `主题::<名字>`（`topicTag`）；AI 自己已经写了 `主题::` 前缀的，不重复加。
- 软件原来自己的标签（`lang:de`、`askfree-2026-10-30`）留着。

## 在软件里预览

`renderCard(side, fields)` 照 Anki 的规则把字段填进正面或背面：`{{字段}}`、`{{text:字段}}`（去掉标签、还原 `&amp;` 这几个实体）、`{{#字段}}…{{/字段}}`、`{{^字段}}…{{/字段}}`。字段算不算空照 Anki 的 `field_is_empty`：只有 ASCII 空白和 `<br>`、`<div>`、`</div>` 算空，`&nbsp;` 不算空。`previewHTML(side, fields, {dark})` 再套上样式，出一整页，深色时 `body` 带 `nightMode night_mode`。
