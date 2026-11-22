// AnkiConnect（Anki 的插件，只听本机 127.0.0.1:8765）的请求和送卡的步骤。
// 这里不连网：每一步交给软件传进来的 call(action, params) 去发，软件自己管地址、超时和连不上时怎么说。
// 规范：spec/notetype.md、spec/decks.md、spec/dedupe.md
import type { Fields } from './fields.js'
import { BACK, CSS, FRONT, NOTE_TYPE } from './spec.js'
import { dedupeKey } from './text.js'

/** 发一个 AnkiConnect 请求，回 result；Anki 回了 error 要抛出来（readReply 做的事） */
export type AnkiCall = (action: string, params?: Record<string, unknown>) => Promise<unknown>

export const ANKI_CONNECT_VERSION = 6
/** AnkiConnect 在 AnkiWeb 上的编号，也是 addons21 下的文件夹名 */
export const ANKI_CONNECT_ADDON = '2055492159'
export const ANKI_CONNECT_URL = 'http://127.0.0.1:8765'

export type CardFamilyErrorKind = 'api' | 'bad-response' | 'customized-style' | 'names-taken'

export class CardFamilyError extends Error {
  constructor(
    readonly kind: CardFamilyErrorKind,
    message: string,
    /** customized-style 时是哪个笔记类型 */
    readonly model?: string,
  ) {
    super(message)
  }
}

/** 一个请求的 JSON：{action, version: 6, params}，没有参数就不带 params */
export const requestBody = (action: string, params?: Record<string, unknown>): Record<string, unknown> =>
  params === undefined ? { action, version: ANKI_CONNECT_VERSION } : { action, version: ANKI_CONNECT_VERSION, params }

/** AnkiConnect 的英文错误里，常见的换成能看懂的话 */
export function readableError(error: string): string {
  if (error.includes('Close the affected editor')) {
    return 'Anki 里开着卡片浏览器或「添加」窗口，Anki 不让这时改笔记类型；关掉它再送'
  }
  return error
}

/** 读回答：{result, error}。error 不空就抛 api 错误（已换成能看懂的话），不是这个样子抛 bad-response */
export function readReply(json: unknown): unknown {
  if (!json || typeof json !== 'object' || !('result' in json) || !('error' in json)) {
    throw new CardFamilyError('bad-response', 'Anki 的回答读不懂')
  }
  const { result, error } = json as { result: unknown; error: unknown }
  if (typeof error === 'string' && error !== '') throw new CardFamilyError('api', `Anki 回了一个错误：${readableError(error)}`)
  return result
}

const badResponse = () => new CardFamilyError('bad-response', 'Anki 的回答读不懂')

/** CSS 第一行（去掉首尾的空格、制表符）`/* 卡片家族 vN *\/` 里的 N；不是这个格式（你在 Anki 里改过）回 null */
export function cssVersion(css: string): number | null {
  const m = /^\/\* 卡片家族 v(\d+) \*\/$/.exec(css.split('\n', 1)[0]!.replace(/^[\p{Zs}\t]+|[\p{Zs}\t]+$/gu, ''))
  return m ? Number(m[1]) : null
}

/** 建笔记类型的参数 */
export const createModelParams = (name: string): Record<string, unknown> => ({
  modelName: name,
  inOrderFields: [...NOTE_TYPE.fields],
  css: CSS,
  isCloze: false,
  cardTemplates: [{ Name: NOTE_TYPE.templateName, Front: FRONT, Back: BACK }],
})

/** 你在 Anki 里改过模板时怎么办：ask 停下来问，replace 换成新的，keep 留着你改的 */
export type CustomizedStyle = 'ask' | 'replace' | 'keep'

const sameFields = (a: unknown): boolean =>
  Array.isArray(a) && a.length === NOTE_TYPE.fields.length && a.every((f, i) => f === NOTE_TYPE.fields[i])

async function restyle(call: AnkiCall, name: string): Promise<void> {
  await call('updateModelStyling', { model: { name, css: CSS } })
  await call('updateModelTemplates', {
    model: { name, templates: { [NOTE_TYPE.templateName]: { Front: FRONT, Back: BACK } } },
  })
}

/**
 * 「学习卡 · 问答」缺了就建；Anki 里的版本旧了就换模板和样式；同名的不是我们的就改用「学习卡 · 问答 2」。
 * 返回要往哪个笔记类型里写。你改过模板又传了 ask，抛 customized-style（error.model 是哪个）
 */
export async function prepareNoteType(call: AnkiCall, customized: CustomizedStyle): Promise<string> {
  const names = await call('modelNames')
  if (!Array.isArray(names)) throw badResponse()
  for (const name of [NOTE_TYPE.name, NOTE_TYPE.otherName]) {
    if (!names.includes(name)) {
      await call('createModel', createModelParams(name))
      return name
    }
    if (!sameFields(await call('modelFieldNames', { modelName: name }))) continue
    const styling = (await call('modelStyling', { modelName: name })) as { css?: unknown } | null
    const v = cssVersion(typeof styling?.css === 'string' ? styling.css : '')
    if (v !== null) {
      // 只往新的换：Anki 里的比我们带的新（别的软件先更新了），不动
      if (v < NOTE_TYPE.version) await restyle(call, name)
    } else if (customized === 'ask') {
      throw new CardFamilyError('customized-style', `「${name}」的模板在 Anki 里改过`, name)
    } else if (customized === 'replace') {
      await restyle(call, name)
    }
    return name
  }
  throw new CardFamilyError('names-taken', `「${NOTE_TYPE.name}」和「${NOTE_TYPE.otherName}」都是别的笔记类型`)
}

/** 牌组按 id 记：先按 id 找现在叫什么（你在 Anki 里改了名跟着走）；找不到按名字找；还没有就建。返回名字和 id，软件记下 id */
export async function resolveDeck(call: AnkiCall, deck: { id?: number | null; name: string }): Promise<{ name: string; id: number }> {
  const decks = await call('deckNamesAndIds')
  if (!decks || typeof decks !== 'object') throw badResponse()
  const entries = Object.entries(decks as Record<string, unknown>)
  if (deck.id != null) {
    const found = entries.find(([, id]) => id === deck.id)
    if (found) return { name: found[0], id: deck.id }
  }
  const byName = entries.find(([name]) => name === deck.name)
  if (byName && typeof byName[1] === 'number') return { name: deck.name, id: byName[1] }
  const created = await call('createDeck', { deck: deck.name })
  if (typeof created !== 'number') throw badResponse()
  return { name: deck.name, id: created }
}

export interface NoteInput {
  deck: string
  model: string
  /** 九个字段，ID 必填（结果按它记） */
  fields: Fields
  tags: string[]
}

/** question：同一批里同牌组同问题只送第一张，再让 Anki 按 Question 在牌组里判；id：按 ID 字段找，Anki 不判 */
export type DedupeBy = 'question' | 'id'

export interface AddResult {
  /** 加进去的卡的 ID 字段 */
  added: string[]
  /** ID 字段 → Anki 的笔记编号 */
  notes: Record<string, number>
  /** 已经有了，没重复加 */
  duplicates: string[]
  /** ID 字段 → 为什么没加进去 */
  failed: Record<string, string>
}

/** addNotes 里一张笔记的 JSON */
export const noteJSON = (n: NoteInput, dedupe: DedupeBy): Record<string, unknown> => ({
  deckName: n.deck,
  modelName: n.model,
  fields: n.fields,
  tags: n.tags,
  options: dedupe === 'question' ? { allowDuplicate: false, duplicateScope: 'deck' } : { allowDuplicate: true },
})

/** 判重键：牌组 + 问题（去掉 HTML 标签以后） */
const batchKey = (n: NoteInput) => `${n.deck}\n${dedupeKey((n.fields.Question ?? '').replace(/<[^>]*>/g, ''))}`

/** 送一批卡。笔记类型、牌组要先准备好（prepareNoteType、resolveDeck） */
export async function addNotes(call: AnkiCall, notes: NoteInput[], dedupe: DedupeBy): Promise<AddResult> {
  const r: AddResult = { added: [], notes: {}, duplicates: [], failed: {} }
  const id = (n: NoteInput) => n.fields.ID ?? ''
  const fresh: NoteInput[] = []
  if (dedupe === 'question') {
    const seen = new Set<string>()
    const go = notes.filter((n) => {
      const k = batchKey(n)
      if (!seen.has(k)) return seen.add(k)
      r.duplicates.push(id(n))
      return false
    })
    if (!go.length) return r
    const checks = await call('canAddNotesWithErrorDetail', { notes: go.map((n) => noteJSON(n, dedupe)) })
    if (!Array.isArray(checks) || checks.length !== go.length) throw badResponse()
    checks.forEach((c: { canAdd?: unknown; error?: unknown }, i) => {
      const n = go[i]!
      const error = typeof c?.error === 'string' ? c.error : ''
      if (c?.canAdd === true) fresh.push(n)
      else if (error.includes('duplicate')) r.duplicates.push(id(n))
      else r.failed[id(n)] = error || '加不进去'
    })
  } else {
    for (const n of notes) {
      const found = await call('findNotes', { query: `"ID:${id(n)}"` })
      if (!Array.isArray(found)) throw badResponse()
      if (found.length) r.duplicates.push(id(n))
      else fresh.push(n)
    }
  }
  if (!fresh.length) return r
  const ids = await call('addNotes', { notes: fresh.map((n) => noteJSON(n, dedupe)) })
  if (!Array.isArray(ids) || ids.length !== fresh.length) throw badResponse()
  fresh.forEach((n, i) => {
    const noteId = ids[i]
    if (typeof noteId === 'number') {
      r.added.push(id(n))
      r.notes[id(n)] = noteId
    } else r.failed[id(n)] = '加不进去'
  })
  return r
}
