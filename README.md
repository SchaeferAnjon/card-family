# 卡片家族 card-family

[English](README.en.md)

写问答卡、送进 Anki 的几个软件共用的一份规范，加上照它写的 TypeScript 包和 Swift 包。

一张卡长什么样、往哪个牌组放、怎么判重、AI 出卡要守哪几条规矩，只在这里写一份。各软件按版本号引用，改一条规矩只改这一处。

这个仓库不调 AI、不存 Key、不连网：出卡用哪家 AI 由各软件自己定；送卡的每一步由软件传进来的 `call` 去发。

## 谁在用

| 软件 | 语言 | 出卡的 AI | 判重 |
| --- | --- | --- | --- |
| ChatCards（原 Anki Learn） | Swift | DeepSeek | 按问题 |
| Ask Free | Swift | DeepSeek / 千问 | 按编号 |
| GetNewWord（Mac） | Swift | 智谱 | 按问题 |
| GetNewWord（Windows） | JavaScript | 智谱 | 按问题 |
| 画布笔记 Canvas Notes | TypeScript | 设置里选的那家 | 按问题 |

它们都往 Anki 里同一个笔记类型「学习卡 · 问答」写卡，样式是「卡片家族 v3」，浅色深色各一套。

## 里面有什么

```text
spec/                规范本身，都是数据文件
  notetype.json      笔记类型的名字、九个字段、版本号
  notetype.md        笔记类型怎么建、怎么升级
  templates/         正面 front.html、背面 back.html、样式 style.css
  rules.zh.md        AI 出卡的规矩原文和输出格式
  fields.md          九个字段怎么填、标签怎么写、预览
  decks.md           牌组：分隔符、名字怎么清理、按 id 记
  dedupe.md          判重：判重键、按问题和按编号两种办法
fixtures/            共用样例：输入和期望输出，两个包的测试读同一批
packages/ts/         TypeScript 包（npm 名 @card-family/core）
packages/swift/      Swift 包（产品名 CardFamily，Package.swift 在仓库根）
scripts/gen.mjs      从 spec/ 生成两个包里的常量
```

两个包做的事一样：

- 读规范数据：笔记类型、模板、样式、出卡规矩（`NOTE_TYPE` / `CardSpec`）。
- 纯文字转字段的 HTML，填九个字段，预览一张卡的正面、背面。
- 判重键、标签、牌组名。
- AnkiConnect 的请求：建或升级笔记类型、按 id 找牌组、加卡（按问题或按编号判重）。

## 怎么引用

### TypeScript

还没发到 npm，用 git 依赖引，写上 tag：

```json
{
  "dependencies": {
    "@card-family/core": "github:SchaeferAnjon/card-family#v0.1.0"
  }
}
```

npm、pnpm 都认这个写法。包是 ES 模块，要 Node 22.12 或更新（CommonJS 里能直接 `require`）。

```ts
import { addNotes, ANKI_CONNECT_URL, deckName, fromTag, prepareNoteType, readReply, requestBody, resolveDeck, studyCardFields, topicTag } from '@card-family/core'

// 软件自己发请求：地址、超时、连不上时怎么说都由软件定
const call = async (action: string, params?: Record<string, unknown>) => {
  const res = await fetch(ANKI_CONNECT_URL, { method: 'POST', body: JSON.stringify(requestBody(action, params)), signal: AbortSignal.timeout(15_000) })
  return readReply(await res.json())
}

const model = await prepareNoteType(call, 'ask')
const deck = await resolveDeck(call, { id: savedDeckId, name: deckName(['课程', 'ecp', 'Week 2']) })
const fields = studyCardFields({ question: '…', answer: '…', label: 'Canvas Notes · ecp', source: 'Lecture05 · 第 12 页', id: 'canvasnotes-1x2y' })
const result = await addNotes(call, [{ deck: deck.name, model, fields, tags: [fromTag('Canvas Notes'), topicTag('ecp')] }], 'question')
```

### Swift

在 `Package.swift` 里：

```swift
.package(url: "https://github.com/SchaeferAnjon/card-family.git", from: "0.1.0")
```

目标里加 `.product(name: "CardFamily", package: "card-family")`。Xcode 项目在「Package Dependencies」里加同一个地址。要 macOS 13 / iOS 16 或更新。

```swift
import CardFamily

let call: AnkiCall = { action, params in
    var request = URLRequest(url: Anki.url, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.httpBody = try JSONSerialization.data(withJSONObject: Anki.requestBody(action, params))
    let (data, _) = try await URLSession.shared.data(for: request)
    return try Anki.readReply(JSONSerialization.jsonObject(with: data))
}

let model = try await Anki.prepareNoteType(call, customized: .ask)
let deck = try await Anki.resolveDeck(call, id: savedDeckID, name: Decks.name(["知识"]))
let fields = StudyCardInput(question: "…", answer: "…", label: "ChatCards · Claude Code", id: "chatcards-…").fields
let result = try await Anki.addNotes(call, [NoteInput(deck: deck.name, model: model, fields: fields, tags: [CardTags.from("ChatCards")])], dedupe: .question)
```

### 两边的名字

| 做什么 | TypeScript | Swift |
| --- | --- | --- |
| 规范常量 | `NOTE_TYPE`、`FRONT`、`BACK`、`CSS`、`CARD_RULES`、`OUTPUT_FORMAT`、`RULES_PROMPT` | `CardSpec.name`、`.fields`、`.front`、`.back`、`.css`、`.cardRules`、`.outputFormat`、`.rulesPrompt` |
| 文字转 HTML | `escapeHTML`、`textHTML`、`pointsHTML`、`numberedHTML` | `CardHTML.escape`、`.text`、`.points`、`.numbered` |
| 九个字段 | `studyCardFields(input)`、`checkFields` | `StudyCardInput(…).fields`、`checkFields` |
| 预览 | `renderCard`、`previewHTML`、`renderTemplate` | `CardPreview.card`、`.page`、`.render` |
| 判重键 | `dedupeKey` | `dedupeKey` |
| 标签 | `tagSafe`、`fromTag`、`topicTag` | `CardTags.safe`、`.from`、`.topic` |
| 牌组名 | `deckName(parts)` | `Decks.name(parts)` |
| AnkiConnect | `requestBody`、`readReply`、`prepareNoteType`、`resolveDeck`、`addNotes`、`idQuery`、`cssVersion` | `Anki.requestBody`、`.readReply`、`.prepareNoteType`、`.resolveDeck`、`.addNotes`、`.idQuery`、`.cssVersion` |

## 改规范的流程

1. 改 `spec/` 里的数据文件。改模板或样式时把 `notetype.json` 的 `version` 加一，`style.css` 第一行跟着改成新的 `/* 卡片家族 vN */`。
2. 跑 `npm run gen`，把规范重新生成进两个包。
3. 改了行为就在 `fixtures/` 里加样例，写上期望的输出。
4. `npm test` 和 `swift test` 都过。两个包读同一批样例，结果不一样就不过；生成的常量和 `spec/` 对不上也不过。
5. 提交，打 tag（`v0.2.0` 这样），推上去。
6. 各软件把依赖的版本号改成新的 tag，跑自己的测试，发版。

版本号照语义化版本：只改样式或规矩文字加第二位，改了函数的用法加第一位。

## 几条不变的

- 九个字段的名字和顺序永远不改：在 Anki 里改字段要单向同步。
- 样式只往新的换：Anki 里的版本比软件带的新，软件不动它。旧版软件出的卡，样子由 Anki 里最新的样式管。
- 你在 Anki 里改过的模板，软件不悄悄覆盖：手动送卡的先问，自动送卡的留着。

## 许可证

[GPL-3.0-or-later](LICENSE)
