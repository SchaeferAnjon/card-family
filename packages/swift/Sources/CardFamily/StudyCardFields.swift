// 填「学习卡 · 问答」的九个字段（规范：spec/fields.md）
import Foundation

public struct CardImage: Codable, Equatable, Sendable {
    /// Anki 媒体库里的文件名（storeMediaFile 回的那个）
    public var src: String
    /// 放在问题下面（Ask Free 看屏幕问的那一屏、画布笔记框的图）；不放的收进纸底「当时的画面」
    public var lead: Bool?
    /// 显示宽度（像素），四舍五入成整数
    public var width: Double?

    public init(src: String, lead: Bool? = nil, width: Double? = nil) {
        self.src = src
        self.lead = lead
        self.width = width
    }

    public var html: String {
        let cls = lead == true ? " class=\"lead\"" : ""
        let w = width.map { " width=\"\(Int($0.rounded()))\"" } ?? ""
        return "<img\(cls) src=\"\(CardHTML.escape(src))\"\(w)>"
    }
}

/// 一张卡的纯文字。question、answer、more、quote 是 AI 出的字；label、source、link 原样转义；id 原样
public struct StudyCardInput: Codable, Equatable, Sendable {
    public enum AnswerStyle: String, Codable, Sendable {
        case text
        /// 答案是几条要点，两行以上写成 <ol>
        case numbered
    }

    public var question: String
    public var answer: String
    /// 补充：一行一条
    public var more: String?
    /// 原文摘句
    public var quote: String?
    public var image: CardImage?
    /// 纸顶小字：「<软件> · <来源>」
    public var label: String
    /// 出处：「<标题> · <日期>」
    public var source: String?
    public var link: String?
    /// <软件前缀>-<编号>
    public var id: String
    public var answerStyle: AnswerStyle?

    public init(question: String, answer: String, more: String? = nil, quote: String? = nil, image: CardImage? = nil,
                label: String, source: String? = nil, link: String? = nil, id: String, answerStyle: AnswerStyle? = nil) {
        self.question = question
        self.answer = answer
        self.more = more
        self.quote = quote
        self.image = image
        self.label = label
        self.source = source
        self.link = link
        self.id = id
        self.answerStyle = answerStyle
    }

    /// 九个字段的 HTML
    public var fields: [String: String] {
        [
            "Question": CardHTML.text(question),
            "Answer": answerStyle == .numbered ? CardHTML.numbered(answer) : CardHTML.text(answer),
            "More": CardHTML.points(more ?? ""),
            "Quote": CardHTML.text(quote ?? ""),
            "Image": image?.html ?? "",
            "Label": CardHTML.escape(label),
            "Source": CardHTML.escape(source ?? ""),
            "Link": CardHTML.escape(link ?? ""),
            "ID": id,
        ]
    }
}

/// 自己拼的字段核一下：缺了哪些、多了哪些（都空就是九个正好）
public func checkFields(_ fields: [String: String]) -> (missing: [String], extra: [String]) {
    (CardSpec.fields.filter { fields[$0] == nil }, fields.keys.filter { !CardSpec.fields.contains($0) }.sorted())
}
