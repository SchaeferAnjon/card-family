// 读 fixtures/ 里的共用样例：Swift 包的测试读的是同一批，两边结果必须一样
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as cf from '../dist/index.js'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8'))

for (const c of fixture('text.json').cases as { fn: string; input: unknown; expect: unknown }[]) {
  test(`text.json ${c.fn}(${JSON.stringify(c.input)})`, () => {
    const fn = (cf as unknown as Record<string, (x: unknown) => unknown>)[c.fn]
    ok(fn, `没有 ${c.fn}`)
    deepStrictEqual(fn(c.input), c.expect)
  })
}

for (const c of fixture('cards.json').cases) {
  test(`cards.json ${c.name}`, () => {
    const fields = cf.studyCardFields(c.input)
    deepStrictEqual(fields, c.fields, c.name)
    deepStrictEqual(cf.checkFields(fields), { missing: [], extra: [] })
    strictEqual(cf.renderCard('front', fields), c.front, `${c.name}：正面`)
    strictEqual(cf.renderCard('back', fields), c.back, `${c.name}：背面`)
  })
}

test('preview.json：整页预览', () => {
  for (const c of fixture('preview.json').cases) strictEqual(cf.previewHTML(c.side, c.fields, { dark: c.dark }), c.expect)
})

test('requests.json：请求的 JSON', () => {
  const r = fixture('requests.json')
  for (const c of r.requestBody) deepStrictEqual(cf.requestBody(c.action, c.params), c.expect)
  for (const c of r.createModelParams) deepStrictEqual(cf.createModelParams(c.name), c.expect)
  for (const c of r.noteJSON) deepStrictEqual(cf.noteJSON(c.note, c.dedupe), c.expect)
  for (const c of r.readReply) {
    if (c.error) {
      try {
        cf.readReply(c.reply)
        throw new Error(`应该抛错：${JSON.stringify(c.reply)}`)
      } catch (e) {
        ok(e instanceof cf.CardFamilyError)
        strictEqual(e.kind, c.error)
        strictEqual(e.message, c.message)
      }
    } else deepStrictEqual(cf.readReply(c.reply), c.expect)
  }
})

for (const c of fixture('sessions.json').cases) {
  test(`sessions.json ${c.op}：${c.name}`, async () => {
    let i = 0
    const call: cf.AnkiCall = async (action, params) => {
      const step = c.steps[i++]
      ok(step, `${c.name}：多发了 ${action}`)
      deepStrictEqual(cf.requestBody(action, params), step.request, `${c.name}：第 ${i} 步`)
      return cf.readReply(step.reply)
    }
    const run = (cf as unknown as Record<string, (call: cf.AnkiCall, ...args: unknown[]) => Promise<unknown>>)[c.op]!
    if (c.error) {
      await run(call, ...c.args).then(
        () => {
          throw new Error(`${c.name}：应该抛错`)
        },
        (e: unknown) => {
          ok(e instanceof cf.CardFamilyError, `${c.name}：${String(e)}`)
          deepStrictEqual({ kind: e.kind, message: e.message, ...(e.model ? { model: e.model } : {}) }, c.error, c.name)
        },
      )
    } else deepStrictEqual(await run(call, ...c.args), c.expect, c.name)
    strictEqual(i, c.steps.length, `${c.name}：少发了请求`)
  })
}
