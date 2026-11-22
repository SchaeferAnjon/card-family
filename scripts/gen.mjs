// 从 spec/ 生成两个包里的规范常量：packages/ts/src/spec.ts 和 packages/swift/Sources/CardFamily/Spec.swift。
// 改了 spec/ 就跑 `npm run gen`；两个包的测试都会拿生成的常量和 spec/ 原文比对，没重新生成测试就不过。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, 'spec', p), 'utf8')
/** 模板文件末尾那一个换行不算 */
const template = (p) => read(p).replace(/\n$/, '')

const noteType = JSON.parse(read('notetype.json'))
const front = template(noteType.templates.front)
const back = template(noteType.templates.back)
const css = template(noteType.templates.css)
const firstLine = noteType.cssFirstLine.replace('{version}', String(noteType.version))
if (css.split('\n')[0] !== firstLine) throw new Error(`style.css 第一行应是「${firstLine}」，现在是「${css.split('\n')[0]}」`)

/** rules.zh.md 里某一节的正文 */
function section(md, heading) {
  const start = md.indexOf(`\n## ${heading}\n`)
  if (start < 0) throw new Error(`rules.zh.md 里没有「## ${heading}」`)
  const rest = md.slice(start + heading.length + 5)
  const end = rest.search(/\n## /)
  return end < 0 ? rest : rest.slice(0, end)
}
const rules = read('rules.zh.md')
const cardRules = section(rules, '卡片的写法')
  .split('\n')
  .filter((l) => l.startsWith('- '))
  .map((l) => l.slice(2))
const fence = /```json\n(.*)\n```/.exec(section(rules, '输出格式'))
if (!fence || !cardRules.length) throw new Error('rules.zh.md 的「卡片的写法」或「输出格式」读不出来')
const outputFormat = fence[1]
const rulesPrompt = `卡片的写法：\n${cardRules.map((r) => `- ${r}`).join('\n')}\n\n只输出 JSON，格式：\n${outputFormat}`

const fields = noteType.fields.map((f) => f.name)
const header = '由 scripts/gen.mjs 从 spec/ 生成，不要手改；改 spec/ 再跑 `npm run gen`。'

const ts = `// ${header}

export const NOTE_TYPE = {
  name: ${JSON.stringify(noteType.name)},
  otherName: ${JSON.stringify(noteType.otherName)},
  templateName: ${JSON.stringify(noteType.templateName)},
  version: ${noteType.version},
  fields: ${JSON.stringify(fields)},
} as const

export const FRONT: string = ${JSON.stringify(front)}

export const BACK: string = ${JSON.stringify(back)}

export const CSS: string = ${JSON.stringify(css)}

export const CARD_RULES: readonly string[] = ${JSON.stringify(cardRules, null, 2)}

export const OUTPUT_FORMAT: string = ${JSON.stringify(outputFormat)}

export const RULES_PROMPT: string = ${JSON.stringify(rulesPrompt)}
`

/** Swift 的原样字符串：#"""…"""#，里面的反斜杠、引号都不用转义 */
const raw = (s) => {
  if (s.includes('"""#')) throw new Error('规范文字里不能有 """#')
  return `#"""\n${s}\n"""#`
}
/** 一行的原样字符串：#"…"# */
const line = (s) => {
  if (s.includes('\n') || s.includes('"#')) throw new Error(`这一条不能有换行或 "#：${s}`)
  return `#"${s}"#`
}
const swift = `// ${header}

public enum CardSpec {
    public static let name = ${JSON.stringify(noteType.name)}
    public static let otherName = ${JSON.stringify(noteType.otherName)}
    public static let templateName = ${JSON.stringify(noteType.templateName)}
    public static let version = ${noteType.version}
    public static let fields = [${fields.map((f) => JSON.stringify(f)).join(', ')}]

    public static let front = ${raw(front)}

    public static let back = ${raw(back)}

    public static let css = ${raw(css)}

    public static let cardRules: [String] = [
${cardRules.map((r) => `        ${line(r)}`).join(',\n')},
    ]

    public static let outputFormat = ${line(outputFormat)}

    public static let rulesPrompt = ${raw(rulesPrompt)}
}
`

writeFileSync(join(root, 'packages/ts/src/spec.ts'), ts)
writeFileSync(join(root, 'packages/swift/Sources/CardFamily/Spec.swift'), swift)
console.log(`生成好了：笔记类型 v${noteType.version}，${fields.length} 个字段，${cardRules.length} 条规矩`)
