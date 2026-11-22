/** 转义 & < > " */
export declare const escapeHTML: (s: string) => string;
/** 纯文字（偶尔带 `代码`、**加粗**）转一段 HTML；\r\n、\r 都当换行 */
export declare function textHTML(text: string): string;
/** 补充：两条以上写成 <ul>，一条就是一段 */
export declare function pointsHTML(text: string): string;
/** 答案本身是几条要点：两条以上写成 <ol>（纸上是编号方块），一条就是一段 */
export declare function numberedHTML(text: string): string;
/** 两个问题是不是同一个：小写，去掉空白（White_Space）和标点（类别 P），按码位算 */
export declare const dedupeKey: (q: string) => string;
/** 标签里不能有空格：去掉首尾空白，中间连续的空白换成一个 _ */
export declare const tagSafe: (s: string) => string;
/** 来自::<软件> */
export declare const fromTag: (app: string) => string;
/** 主题::<名字>；已经带了「主题::」的不重复加；名字是空的回空串 */
export declare function topicTag(name: string): string;
/** 几节拼成牌组名，用 :: 分层；清理后是空的那一节去掉 */
export declare const deckName: (parts: readonly string[]) => string;
/** 卡片浏览器里只看这几张："ID:a" OR "ID:b" */
export declare const idQuery: (ids: readonly string[]) => string;
