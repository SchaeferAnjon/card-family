// 填「学习卡 · 问答」的九个字段（规范：spec/fields.md）
import { NOTE_TYPE } from './spec.js';
import { escapeHTML, numberedHTML, pointsHTML, textHTML } from './text.js';
export function imageHTML(image) {
    const cls = image.lead ? ' class="lead"' : '';
    const width = image.width === undefined ? '' : ` width="${Math.round(image.width)}"`;
    return `<img${cls} src="${escapeHTML(image.src)}"${width}>`;
}
export function studyCardFields(c) {
    return {
        Question: textHTML(c.question),
        Answer: c.answerStyle === 'numbered' ? numberedHTML(c.answer) : textHTML(c.answer),
        More: pointsHTML(c.more ?? ''),
        Quote: textHTML(c.quote ?? ''),
        Image: c.image ? imageHTML(c.image) : '',
        Label: escapeHTML(c.label),
        Source: escapeHTML(c.source ?? ''),
        Link: escapeHTML(c.link ?? ''),
        ID: c.id,
    };
}
/** 自己拼的字段核一下：缺了哪些、多了哪些（都空就是九个正好） */
export function checkFields(fields) {
    const names = NOTE_TYPE.fields;
    return {
        missing: names.filter((n) => !(n in fields)),
        extra: Object.keys(fields).filter((n) => !names.includes(n)),
    };
}
