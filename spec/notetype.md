# 笔记类型「学习卡 · 问答」

名字、字段、版本号在 `notetype.json`，模板和样式在 `templates/`（`front.html`、`back.html`、`style.css`，文件末尾那一个换行不算）。

## 规矩

- 写问答卡的软件共用这一个笔记类型，卡片模板名「问答」。
- 九个字段，英文名，顺序固定，永远不加、不删、不改名（那要单向同步）。
- 样式第一行是 `/* 卡片家族 vN */`。改模板或样式就把 `notetype.json` 的 `version` 加一，第一行跟着改。
- 模板里的固定字（原文、当时的画面、打开原文）是中文，共用一份，不跟界面语言变。
- 不用 `{{FrontSide}}`、不用 `id="answer"`：纸要把问题和答案包在同一个元素里，翻面时问题不跳。
- 颜色全部走 `.card` 上的变量，深色在 `.card.nightMode, .nightMode .card, .card.night_mode, .night_mode .card` 里重写。

## 建和升级（`prepareNoteType` 做的事）

依次看「学习卡 · 问答」和「学习卡 · 问答 2」：

1. Anki 里没有这个名字：`createModel` 建一个，用它。
2. 有，但字段和九个字段对不上：那是你自己的，不碰，看下一个名字。
3. 有，字段对得上，读样式第一行：
   - 是 `/* 卡片家族 vN */`，N 比我们带的小：`updateModelStyling` 和 `updateModelTemplates` 换成新的。
   - N 一样或更大（别的软件先升级了）：不动。
   - 不是这个格式，说明你在 Anki 里改过模板。看软件传进来的做法：
     - `ask`：停下来问你（手动送卡的软件：ChatCards、Ask Free、画布笔记）。
     - `replace`：你选了「换成新样子」。
     - `keep`：你选了「留着我改的」，或者是自动送卡、不能弹窗的软件（GetNewWord）。
4. 两个名字都是别人的：报错，不送。

只换模板文字和样式不需要单向同步。AnkiConnect 在 Anki 的卡片浏览器或「添加」窗口开着时不让改笔记类型（回 `Close the affected editor…`），`readableError` 把它换成「关掉它再送」。
