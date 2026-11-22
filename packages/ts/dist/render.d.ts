import type { Fields } from './fields.js';
/** Anki 当成空的字段：只有 ASCII 空白和 <br>、<br/>、<div>、</div> 这些（照 Anki 的 field_is_empty） */
export declare const fieldIsEmpty: (html: string) => boolean;
/**
 * 填模板：{{字段}}、{{text:字段}}、{{#字段}}…{{/字段}}（字段不空才有）、{{^字段}}…{{/字段}}（字段空才有）。
 * 字典里没有的字段当空的
 */
export declare function renderTemplate(template: string, fields: Fields): string;
export type Side = 'front' | 'back';
/** 这一面填好字段的 HTML（不带样式） */
export declare const renderCard: (side: Side, fields: Fields) => string;
/** 一整页能直接打开的预览：带样式，dark 时 body 带 Anki 深色模式的两个 class */
export declare function previewHTML(side: Side, fields: Fields, options?: {
    dark?: boolean;
}): string;
