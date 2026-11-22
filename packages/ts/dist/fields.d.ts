export type Fields = Record<string, string>;
export interface CardImage {
    /** Anki 媒体库里的文件名（storeMediaFile 回的那个） */
    src: string;
    /** 放在问题下面（Ask Free 看屏幕问的那一屏、画布笔记框的图）；不放的收进纸底「当时的画面」 */
    lead?: boolean;
    /** 显示宽度（像素），四舍五入成整数 */
    width?: number;
}
/** 一张卡的纯文字。question、answer、more、quote 是 AI 出的字；label、source、link 原样转义；id 原样 */
export interface StudyCardInput {
    question: string;
    answer: string;
    /** 补充：一行一条 */
    more?: string;
    /** 原文摘句 */
    quote?: string;
    image?: CardImage;
    /** 纸顶小字：「<软件> · <来源>」 */
    label: string;
    /** 出处：「<标题> · <日期>」 */
    source?: string;
    link?: string;
    /** <软件前缀>-<编号> */
    id: string;
    /** numbered：答案是几条要点，两行以上写成 <ol> */
    answerStyle?: 'text' | 'numbered';
}
export declare function imageHTML(image: CardImage): string;
export declare function studyCardFields(c: StudyCardInput): Fields;
/** 自己拼的字段核一下：缺了哪些、多了哪些（都空就是九个正好） */
export declare function checkFields(fields: Fields): {
    missing: string[];
    extra: string[];
};
