// 纯文字转 Anki 字段的 HTML、判重键、标签、牌组名（规范：spec/fields.md、spec/dedupe.md、spec/decks.md）
// 和 TS 包的 text.ts 一一对应，按 Unicode 码位算，两边跑同一批样例（fixtures/text.json）
import Foundation

extension Unicode.Scalar {
    var isWhite: Bool { properties.isWhitespace }
    var isPunctuation: Bool {
        switch properties.generalCategory {
        case .connectorPunctuation, .dashPunctuation, .openPunctuation, .closePunctuation,
             .initialPunctuation, .finalPunctuation, .otherPunctuation: return true
        default: return false
        }
    }
}

extension String {
    /// 去掉首尾的空白（Unicode White_Space）
    var trimmedWhite: String {
        var v = Substring(self).unicodeScalars
        while let f = v.first, f.isWhite { v.removeFirst() }
        while let l = v.last, l.isWhite { v.removeLast() }
        return String(v)
    }

    func filterScalars(_ keep: (Unicode.Scalar) -> Bool) -> String {
        var v = String.UnicodeScalarView()
        v.append(contentsOf: unicodeScalars.filter(keep))
        return String(v)
    }

    /// 连续的空白并成一个 sep；首尾的空白直接去掉
    func splitWhite() -> [String] {
        var parts: [String] = []
        var cur = String.UnicodeScalarView()
        for s in unicodeScalars {
            if s.isWhite {
                if !cur.isEmpty { parts.append(String(cur)); cur = String.UnicodeScalarView() }
            } else {
                cur.append(s)
            }
        }
        if !cur.isEmpty { parts.append(String(cur)) }
        return parts
    }

    func replacing(_ regex: NSRegularExpression, with template: String) -> String {
        regex.stringByReplacingMatches(in: self, range: NSRange(startIndex..., in: self), withTemplate: template)
    }
}

public enum CardHTML {
    /// 转义 & < > "
    public static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static let code = try! NSRegularExpression(pattern: "`([^`\\n]+)`")
    private static let bold = try! NSRegularExpression(pattern: "\\*\\*([^*\\n]+)\\*\\*")

    /// 纯文字（偶尔带 `代码`、**加粗**）转一段 HTML；\r\n、\r 都当换行
    public static func text(_ text: String) -> String {
        let s = escape(text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").trimmedWhite)
        return s.replacing(code, with: "<code>$1</code>").replacing(bold, with: "<b>$1</b>")
            .replacingOccurrences(of: "\n", with: "<br>")
    }

    /// 一行一条：按换行分，去掉行首的 - • · * 和它后面的空白，空行不算
    static func lines(_ text: String) -> [String] {
        text.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline)
            .map { line -> String in
                let t = String(line).trimmedWhite
                guard let f = t.unicodeScalars.first, "-•·*".unicodeScalars.contains(f) else { return t }
                return String(t.unicodeScalars.dropFirst()).trimmedWhite
            }
            .filter { !$0.isEmpty }
    }

    /// 补充：两条以上写成 <ul>，一条就是一段
    public static func points(_ text: String) -> String {
        let l = lines(text)
        guard l.count > 1 else { return self.text(text) }
        return "<ul>" + l.map { "<li>\(self.text($0))</li>" }.joined() + "</ul>"
    }

    /// 答案本身是几条要点：两条以上写成 <ol>（纸上是编号方块），一条就是一段
    public static func numbered(_ text: String) -> String {
        let l = lines(text)
        guard l.count > 1 else { return self.text(text) }
        return "<ol>" + l.map { "<li>\(self.text($0))</li>" }.joined() + "</ol>"
    }
}

/// 两个问题是不是同一个：小写，去掉空白（White_Space）和标点（类别 P），按码位算
public func dedupeKey(_ q: String) -> String {
    q.lowercased().filterScalars { !$0.isWhite && !$0.isPunctuation }
}

public enum CardTags {
    /// 标签里不能有空格：去掉首尾空白，中间连续的空白换成一个 _
    public static func safe(_ s: String) -> String { s.splitWhite().joined(separator: "_") }

    /// 来自::<软件>
    public static func from(_ app: String) -> String { "来自::" + safe(app) }

    /// 主题::<名字>；已经带了「主题::」的不重复加；名字是空的回空串
    public static func topic(_ name: String) -> String {
        var n = name.trimmedWhite
        if n.hasPrefix("主题::") { n = String(n.dropFirst("主题::".count)) }
        let t = safe(n)
        return t.isEmpty ? "" : "主题::" + t
    }
}

public enum Decks {
    /// 牌组名的一节：自带的 :: 换成全角冒号，去掉控制字符（算空白的除外），空白并成一个空格、去首尾
    static func part(_ s: String) -> String {
        s.replacingOccurrences(of: "::", with: "：")
            .filterScalars { $0.isWhite || $0.properties.generalCategory != .control }
            .splitWhite().joined(separator: " ")
    }

    /// 几节拼成牌组名，用 :: 分层；清理后是空的那一节去掉
    public static func name(_ parts: [String]) -> String {
        parts.map(part).filter { !$0.isEmpty }.joined(separator: "::")
    }
}
