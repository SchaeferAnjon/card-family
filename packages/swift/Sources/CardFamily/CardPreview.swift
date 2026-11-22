// 软件里预览一张卡：照 Anki 的模板规则把字段填进正面、背面（只认我们模板用到的写法）
import Foundation

public enum CardPreview {
    public enum Side: String, Sendable {
        case front, back
    }

    private static let empty = try! NSRegularExpression(pattern: "^(?:[\\t\\n\\x{0B}\\f\\r ]|</?(?:br|div) ?/?>)*$", options: [.caseInsensitive])
    private static let tag = try! NSRegularExpression(pattern: "\\{\\{([#^/]?)([^{}]*)\\}\\}")
    private static let htmlTag = try! NSRegularExpression(pattern: "<[^>]*>")
    private static let entity = try! NSRegularExpression(pattern: "&(amp|lt|gt|quot|#39|nbsp);")

    /// Anki 当成空的字段：只有 ASCII 空白和 <br>、<br/>、<div>、</div> 这些（照 Anki 的 field_is_empty）
    public static func fieldIsEmpty(_ html: String) -> Bool {
        empty.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)) != nil
    }

    /// {{text:字段}}：去掉标签，还原 &amp; &lt; &gt; &quot; &#39; &nbsp;
    static func plain(_ html: String) -> String {
        let s = html.replacing(htmlTag, with: "") as NSString
        let map = ["amp": "&", "lt": "<", "gt": ">", "quot": "\"", "#39": "'", "nbsp": "\u{a0}"]
        var out = ""
        var at = 0
        for m in entity.matches(in: s as String, range: NSRange(location: 0, length: s.length)) {
            out += s.substring(with: NSRange(location: at, length: m.range.location - at))
            out += map[s.substring(with: m.range(at: 1))]!
            at = m.range.location + m.range.length
        }
        return out + s.substring(from: at)
    }

    struct TemplateError: Error, CustomStringConvertible {
        let description: String
    }

    /// 填模板：{{字段}}、{{text:字段}}、{{#字段}}…{{/字段}}（字段不空才有）、{{^字段}}…{{/字段}}（字段空才有）。字典里没有的字段当空的
    public static func render(template: String, fields: [String: String]) throws -> String {
        let t = template as NSString
        var out = ""
        var at = 0
        var open: [(name: String, show: Bool)] = []
        func showing() -> Bool { open.allSatisfy(\.show) }
        for m in tag.matches(in: template, range: NSRange(location: 0, length: t.length)) {
            if showing() { out += t.substring(with: NSRange(location: at, length: m.range.location - at)) }
            at = m.range.location + m.range.length
            let kind = t.substring(with: m.range(at: 1))
            let name = t.substring(with: m.range(at: 2)).trimmedWhite
            switch kind {
            case "#", "^":
                let isEmpty = fieldIsEmpty(fields[name] ?? "")
                open.append((name, kind == "#" ? !isEmpty : isEmpty))
            case "/":
                guard open.popLast()?.name == name else { throw TemplateError(description: "模板里的 {{/\(name)}} 对不上") }
            default:
                if showing() {
                    out += name.hasPrefix("text:") ? plain(fields[String(name.dropFirst(5))] ?? "") : (fields[name] ?? "")
                }
            }
        }
        if let last = open.last { throw TemplateError(description: "模板里的 {{#\(last.name)}} 没有收尾") }
        return out + t.substring(from: at)
    }

    /// 这一面填好字段的 HTML（不带样式）
    public static func card(_ side: Side, fields: [String: String]) -> String {
        // 我们自己的模板一定对得上，测试里核过
        try! render(template: side == .front ? CardSpec.front : CardSpec.back, fields: fields)
    }

    /// 一整页能直接打开的预览：带样式，dark 时 body 带 Anki 深色模式的两个 class
    public static func page(_ side: Side, fields: [String: String], dark: Bool = false) -> String {
        let cls = dark ? "card nightMode night_mode" : "card"
        return """
        <!doctype html>
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
        \(CardSpec.css)
        html, body { margin: 0; }
        </style></head>
        <body class="\(cls)">
        \(card(side, fields: fields))
        </body></html>

        """
    }
}
