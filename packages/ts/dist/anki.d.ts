import type { Fields } from './fields.js';
/** 发一个 AnkiConnect 请求，回 result；Anki 回了 error 要抛出来（readReply 做的事） */
export type AnkiCall = (action: string, params?: Record<string, unknown>) => Promise<unknown>;
export declare const ANKI_CONNECT_VERSION = 6;
/** AnkiConnect 在 AnkiWeb 上的编号，也是 addons21 下的文件夹名 */
export declare const ANKI_CONNECT_ADDON = "2055492159";
export declare const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
export type CardFamilyErrorKind = 'api' | 'bad-response' | 'customized-style' | 'names-taken';
export declare class CardFamilyError extends Error {
    readonly kind: CardFamilyErrorKind;
    /** customized-style 时是哪个笔记类型 */
    readonly model?: string | undefined;
    constructor(kind: CardFamilyErrorKind, message: string, 
    /** customized-style 时是哪个笔记类型 */
    model?: string | undefined);
}
/** 一个请求的 JSON：{action, version: 6, params}，没有参数就不带 params */
export declare const requestBody: (action: string, params?: Record<string, unknown>) => Record<string, unknown>;
/** AnkiConnect 的英文错误里，常见的换成能看懂的话 */
export declare function readableError(error: string): string;
/** 读回答：{result, error}。error 不空就抛 api 错误（已换成能看懂的话），不是这个样子抛 bad-response */
export declare function readReply(json: unknown): unknown;
/** CSS 第一行（去掉首尾的空格、制表符）`/* 卡片家族 vN *\/` 里的 N；不是这个格式（你在 Anki 里改过）回 null */
export declare function cssVersion(css: string): number | null;
/** 建笔记类型的参数 */
export declare const createModelParams: (name: string) => Record<string, unknown>;
/** 你在 Anki 里改过模板时怎么办：ask 停下来问，replace 换成新的，keep 留着你改的 */
export type CustomizedStyle = 'ask' | 'replace' | 'keep';
/**
 * 「学习卡 · 问答」缺了就建；Anki 里的版本旧了就换模板和样式；同名的不是我们的就改用「学习卡 · 问答 2」。
 * 返回要往哪个笔记类型里写。你改过模板又传了 ask，抛 customized-style（error.model 是哪个）
 */
export declare function prepareNoteType(call: AnkiCall, customized: CustomizedStyle): Promise<string>;
/** 牌组按 id 记：先按 id 找现在叫什么（你在 Anki 里改了名跟着走）；找不到按名字找；还没有就建。返回名字和 id，软件记下 id */
export declare function resolveDeck(call: AnkiCall, deck: {
    id?: number | null;
    name: string;
}): Promise<{
    name: string;
    id: number;
}>;
export interface NoteInput {
    deck: string;
    model: string;
    /** 九个字段，ID 必填（结果按它记） */
    fields: Fields;
    tags: string[];
}
/** question：同一批里同牌组同问题只送第一张，再让 Anki 按 Question 在牌组里判；id：按 ID 字段找，Anki 不判 */
export type DedupeBy = 'question' | 'id';
export interface AddResult {
    /** 加进去的卡的 ID 字段 */
    added: string[];
    /** ID 字段 → Anki 的笔记编号 */
    notes: Record<string, number>;
    /** 已经有了，没重复加 */
    duplicates: string[];
    /** ID 字段 → 为什么没加进去 */
    failed: Record<string, string>;
}
/** addNotes 里一张笔记的 JSON */
export declare const noteJSON: (n: NoteInput, dedupe: DedupeBy) => Record<string, unknown>;
/** 送一批卡。笔记类型、牌组要先准备好（prepareNoteType、resolveDeck） */
export declare function addNotes(call: AnkiCall, notes: NoteInput[], dedupe: DedupeBy): Promise<AddResult>;
