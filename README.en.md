# card-family

[中文](README.md)

One shared spec for the apps that write question-and-answer cards and send them to Anki, plus a TypeScript package and a Swift package that implement it.

What a card looks like, which deck it goes into, how duplicates are detected, and which rules the AI follows when it writes cards are written down once, here. Each app pins a version; changing a rule means changing it in one place.

This repository calls no AI, stores no keys and opens no network connections: each app picks its own AI for writing cards, and every AnkiConnect request goes through a `call` function the app passes in.

## Who uses it

| App | Language | AI that writes the cards | Duplicates by |
| --- | --- | --- | --- |
| ChatCards (formerly Anki Learn) | Swift | DeepSeek | question |
| Ask Free | Swift | DeepSeek / Qwen | ID |
| GetNewWord (Mac) | Swift | Zhipu | question |
| GetNewWord (Windows) | JavaScript | Zhipu | question |
| Canvas Notes | TypeScript | whichever is chosen in Settings | question |

They all write into the same Anki note type, 学习卡 · 问答 ("study card · Q&A"), styled as "card family v3" with a light and a dark theme.

## What is inside

```text
spec/                the spec itself, as data files (written in Chinese)
  notetype.json      note type name, the nine fields, version
  notetype.md        how the note type is created and upgraded
  templates/         front.html, back.html, style.css
  rules.zh.md        the card-writing rules for the AI and the output format
  fields.md          how the nine fields are filled, tags, preview
  decks.md           decks: separator, cleaning names, remembering decks by id
  dedupe.md          duplicates: the key, by question or by ID
fixtures/            shared examples: inputs and expected outputs, read by both packages' tests
packages/ts/         TypeScript package (npm name @card-family/core)
packages/swift/      Swift package (product CardFamily; Package.swift is at the repository root)
scripts/gen.mjs      generates the constants in both packages from spec/
```

Both packages do the same things:

- Read the spec data: note type, templates, CSS, card-writing rules (`NOTE_TYPE` / `CardSpec`).
- Turn plain text into field HTML, fill the nine fields, and preview a card's front and back.
- Duplicate keys, tags, deck names.
- AnkiConnect requests: create or upgrade the note type, find a deck by id, add notes (duplicates by question or by ID).

## How to use it

### TypeScript

Not on npm yet. Depend on the git tag:

```json
{
  "dependencies": {
    "@card-family/core": "github:SchaeferAnjon/card-family#v0.1.0"
  }
}
```

Works with npm and pnpm. The package is an ES module and needs Node 22.12 or later (CommonJS code can `require` it directly).

```ts
import { addNotes, ANKI_CONNECT_URL, deckName, fromTag, prepareNoteType, readReply, requestBody, resolveDeck, studyCardFields, topicTag } from '@card-family/core'

// The app sends the requests itself: address, timeout and what to say when Anki is closed are up to the app
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

In `Package.swift`:

```swift
.package(url: "https://github.com/SchaeferAnjon/card-family.git", from: "0.1.0")
```

Add `.product(name: "CardFamily", package: "card-family")` to your target. In an Xcode project, add the same URL under Package Dependencies. Needs Xcode 16 (Swift 6) or later and runs on macOS 13 / iOS 16 or later.

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

### Names on both sides

| What | TypeScript | Swift |
| --- | --- | --- |
| Spec constants | `NOTE_TYPE`, `FRONT`, `BACK`, `CSS`, `CARD_RULES`, `OUTPUT_FORMAT`, `RULES_PROMPT` | `CardSpec.name`, `.fields`, `.front`, `.back`, `.css`, `.cardRules`, `.outputFormat`, `.rulesPrompt` |
| Text to HTML | `escapeHTML`, `textHTML`, `pointsHTML`, `numberedHTML` | `CardHTML.escape`, `.text`, `.points`, `.numbered` |
| The nine fields | `studyCardFields(input)`, `checkFields` | `StudyCardInput(…).fields`, `checkFields` |
| Preview | `renderCard`, `previewHTML`, `renderTemplate` | `CardPreview.card`, `.page`, `.render` |
| Duplicate key | `dedupeKey` | `dedupeKey` |
| Tags | `tagSafe`, `fromTag`, `topicTag` | `CardTags.safe`, `.from`, `.topic` |
| Deck names | `deckName(parts)` | `Decks.name(parts)` |
| AnkiConnect | `requestBody`, `readReply`, `prepareNoteType`, `resolveDeck`, `addNotes`, `idQuery`, `cssVersion` | `Anki.requestBody`, `.readReply`, `.prepareNoteType`, `.resolveDeck`, `.addNotes`, `.idQuery`, `.cssVersion` |

## Changing the spec

1. Edit the data files in `spec/`. When the templates or CSS change, add one to `version` in `notetype.json` and update the first line of `style.css` to the new `/* 卡片家族 vN */`.
2. Run `npm run gen` to regenerate the constants in both packages.
3. If behaviour changed, add examples with their expected output to `fixtures/`.
4. `npm test` (Node 22.18 or later) and `swift test` (Swift 6) must both pass. Both read the same examples, so any difference between the packages fails; generated constants that no longer match `spec/` fail too.
5. Commit, tag (`v0.2.0` and so on), push.
6. Each app bumps the tag it depends on, runs its own tests and ships.

Versions follow semantic versioning: style or rule wording changes bump the minor version, API changes bump the major version.

## Things that do not change

- The names and order of the nine fields never change: changing fields in Anki forces a one-way sync.
- Styles only move forward: if Anki already has a newer version than the app carries, the app leaves it alone. Cards made by an older app take their look from the newest style in Anki.
- Templates you edited in Anki are never overwritten silently: apps where you send cards by hand ask first; apps that send automatically leave them as they are.

## License

[GPL-3.0-or-later](LICENSE)
