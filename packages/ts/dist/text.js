// 纯文字转 Anki 字段的 HTML、判重键、标签、牌组名（规范：spec/fields.md、spec/dedupe.md、spec/decks.md）
/** 转义 & < > " */
export const escapeHTML = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 去掉首尾的空白（Unicode White_Space） */
const trim = (s) => s.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');
/** 纯文字（偶尔带 `代码`、**加粗**）转一段 HTML；\r\n、\r 都当换行 */
export function textHTML(text) {
    return escapeHTML(trim(text.replace(/\r\n?/g, '\n')))
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
}
/** 一行一条：按换行（\r\n、\n、\r、\v、\f、U+0085、U+2028、U+2029）分，去掉行首的 - • · * 和它后面的空白，空行不算 */
const lines = (text) => text
    .split(/\r\n|[\n\v\f\r\u0085\u2028\u2029]/)
    .map((l) => {
    const t = trim(l);
    return /^[-•·*]/.test(t) ? trim(t.slice(1)) : t;
})
    .filter((l) => l !== '');
/** 补充：两条以上写成 <ul>，一条就是一段 */
export function pointsHTML(text) {
    const l = lines(text);
    return l.length > 1 ? `<ul>${l.map((p) => `<li>${textHTML(p)}</li>`).join('')}</ul>` : textHTML(text);
}
/** 答案本身是几条要点：两条以上写成 <ol>（纸上是编号方块），一条就是一段 */
export function numberedHTML(text) {
    const l = lines(text);
    return l.length > 1 ? `<ol>${l.map((p) => `<li>${textHTML(p)}</li>`).join('')}</ol>` : textHTML(text);
}
/** 两个问题是不是同一个：小写，去掉空白（White_Space）和标点（类别 P），按码位算 */
export const dedupeKey = (q) => q.toLowerCase().replace(/[\p{White_Space}\p{P}]/gu, '');
/** 标签里不能有空格：去掉首尾空白，中间连续的空白换成一个 _ */
export const tagSafe = (s) => s
    .split(/\p{White_Space}+/u)
    .filter((w) => w !== '')
    .join('_');
/** 来自::<软件> */
export const fromTag = (app) => `来自::${tagSafe(app)}`;
/** 主题::<名字>；已经带了「主题::」的不重复加；名字是空的回空串 */
export function topicTag(name) {
    const t = tagSafe(trim(name).replace(/^主题::/, ''));
    return t === '' ? '' : `主题::${t}`;
}
/** 牌组名的一节：自带的 :: 换成全角冒号，去掉控制字符（算空白的除外），空白并成一个空格、去首尾 */
const deckPart = (s) => trim(s
    .replace(/::/g, '：')
    .replace(/(?!\p{White_Space})\p{Cc}/gu, '')
    .replace(/\p{White_Space}+/gu, ' '));
/** 几节拼成牌组名，用 :: 分层；清理后是空的那一节去掉 */
export const deckName = (parts) => parts
    .map(deckPart)
    .filter((p) => p !== '')
    .join('::');
/** 卡片浏览器里只看这几张："ID:a" OR "ID:b" */
export const idQuery = (ids) => ids.map((id) => `"ID:${id}"`).join(' OR ');
