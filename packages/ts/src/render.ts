// 软件里预览一张卡：照 Anki 的模板规则把字段填进正面、背面（只认我们模板用到的写法）
import type { Fields } from './fields.js'
import { BACK, CSS, FRONT } from './spec.js'

/** Anki 当成空的字段：只有 ASCII 空白和 <br>、<br/>、<div>、</div> 这些（照 Anki 的 field_is_empty） */
export const fieldIsEmpty = (html: string): boolean => /^(?:[\t\n\v\f\r ]|<\/?(?:br|div) ?\/?>)*$/i.test(html)

/** {{text:字段}}：去掉标签，还原 &amp; &lt; &gt; &quot; &#39; &nbsp; */
const plain = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[e]!)

/**
 * 填模板：{{字段}}、{{text:字段}}、{{#字段}}…{{/字段}}（字段不空才有）、{{^字段}}…{{/字段}}（字段空才有）。
 * 字典里没有的字段当空的
 */
export function renderTemplate(template: string, fields: Fields): string {
  const tag = /\{\{([#^/]?)([^{}]*)\}\}/g
  let out = ''
  let at = 0
  /** 正在里面的段：字段名、这一段显不显示 */
  const open: { name: string; show: boolean }[] = []
  const showing = () => open.every((s) => s.show)
  for (let m = tag.exec(template); m; m = tag.exec(template)) {
    if (showing()) out += template.slice(at, m.index)
    at = m.index + m[0].length
    const [, kind, raw] = m
    const name = raw!.trim()
    if (kind === '#' || kind === '^') {
      const empty = fieldIsEmpty(fields[name] ?? '')
      open.push({ name, show: kind === '#' ? !empty : empty })
    } else if (kind === '/') {
      if (open.pop()?.name !== name) throw new Error(`模板里的 {{/${name}}} 对不上`)
    } else if (showing()) {
      out += name.startsWith('text:') ? plain(fields[name.slice(5)] ?? '') : (fields[name] ?? '')
    }
  }
  if (open.length) throw new Error(`模板里的 {{#${open[open.length - 1]!.name}}} 没有收尾`)
  return out + template.slice(at)
}

export type Side = 'front' | 'back'

/** 这一面填好字段的 HTML（不带样式） */
export const renderCard = (side: Side, fields: Fields): string => renderTemplate(side === 'front' ? FRONT : BACK, fields)

/** 一整页能直接打开的预览：带样式，dark 时 body 带 Anki 深色模式的两个 class */
export function previewHTML(side: Side, fields: Fields, options: { dark?: boolean } = {}): string {
  const cls = options.dark ? 'card nightMode night_mode' : 'card'
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${CSS}
html, body { margin: 0; }
</style></head>
<body class="${cls}">
${renderCard(side, fields)}
</body></html>
`
}
