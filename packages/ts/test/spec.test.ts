// 包里的规范常量要和 spec/ 原文一样（改了 spec/ 没跑 npm run gen，这里不过）
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as cf from '../dist/index.js'

const spec = (p: string) => readFileSync(new URL(`../../../spec/${p}`, import.meta.url), 'utf8')

test('笔记类型、模板、样式和 spec/ 一样', () => {
  const nt = JSON.parse(spec('notetype.json'))
  strictEqual(cf.NOTE_TYPE.name, nt.name)
  strictEqual(cf.NOTE_TYPE.otherName, nt.otherName)
  strictEqual(cf.NOTE_TYPE.templateName, nt.templateName)
  strictEqual(cf.NOTE_TYPE.version, nt.version)
  deepStrictEqual([...cf.NOTE_TYPE.fields], nt.fields.map((f: { name: string }) => f.name))
  strictEqual(cf.FRONT + '\n', spec(nt.templates.front))
  strictEqual(cf.BACK + '\n', spec(nt.templates.back))
  strictEqual(cf.CSS + '\n', spec(nt.templates.css))
  strictEqual(cf.cssVersion(cf.CSS), nt.version)
})

test('出卡规矩和 rules.zh.md 一样', () => {
  const md = spec('rules.zh.md')
  strictEqual(cf.CARD_RULES.length, 6)
  for (const r of cf.CARD_RULES) ok(md.includes(`\n- ${r}\n`), r)
  ok(md.includes('```json\n' + cf.OUTPUT_FORMAT + '\n```'))
  strictEqual(cf.RULES_PROMPT, `卡片的写法：\n${cf.CARD_RULES.map((r) => `- ${r}`).join('\n')}\n\n只输出 JSON，格式：\n${cf.OUTPUT_FORMAT}`)
  // 输出格式本身是能读的 JSON
  ok(Array.isArray(JSON.parse(cf.OUTPUT_FORMAT).cards))
})

test('模板里只用九个字段', () => {
  const used = new Set([...(cf.FRONT + cf.BACK).matchAll(/\{\{[#^/]?(?:text:)?([^{}]+)\}\}/g)].map((m) => m[1]))
  for (const f of used) ok((cf.NOTE_TYPE.fields as readonly string[]).includes(f!), f)
})
