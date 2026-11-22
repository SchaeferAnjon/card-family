// AnkiConnect（Anki 的插件，只听本机 127.0.0.1:8765）的请求和送卡的步骤。
// 这里不连网：每一步交给软件传进来的 call(action, params) 去发，软件自己管地址、超时和连不上时怎么说。
// 规范：spec/notetype.md、spec/decks.md、spec/dedupe.md；和 TS 包的 anki.ts 一一对应
import Foundation

/// 发一个 AnkiConnect 请求，回 result（null 回 nil）；Anki 回了 error 要抛出来（Anki.readReply 做的事）
public typealias AnkiCall = (_ action: String, _ params: [String: Any]?) async throws -> Any?

public enum CardFamilyError: Error, Equatable, LocalizedError {
    /// Anki 回了错误（已换成能看懂的话）
    case api(String)
    case badResponse
    /// 「学习卡 · 问答」的样式第一行不是「卡片家族 vN」：你在 Anki 里改过模板，要先问你换不换
    case customizedStyle(model: String)
    /// 「学习卡 · 问答」和「学习卡 · 问答 2」都是别的笔记类型
    case namesTaken

    public var errorDescription: String? {
        switch self {
        case .api(let message): return "Anki 回了一个错误：\(message)"
        case .badResponse: return "Anki 的回答读不懂"
        case .customizedStyle(let model): return "「\(model)」的模板在 Anki 里改过"
        case .namesTaken: return "「\(CardSpec.name)」和「\(CardSpec.otherName)」都是别的笔记类型"
        }
    }
}

/// 你在 Anki 里改过模板时怎么办
public enum CustomizedStyle: String, Codable, Sendable {
    /// 停下来问你
    case ask
    /// 换成新的
    case replace
    /// 留着你改的
    case keep
}

/// question：同一批里同牌组同问题只送第一张，再让 Anki 按 Question 在牌组里判；id：按 ID 字段找，Anki 不判
public enum DedupeBy: String, Codable, Sendable {
    case question, id
}

public struct NoteInput: Codable, Equatable, Sendable {
    public var deck: String
    public var model: String
    /// 九个字段，ID 必填（结果按它记）
    public var fields: [String: String]
    public var tags: [String]

    public init(deck: String, model: String, fields: [String: String], tags: [String]) {
        self.deck = deck
        self.model = model
        self.fields = fields
        self.tags = tags
    }
}

public struct AddResult: Codable, Equatable, Sendable {
    /// 加进去的卡的 ID 字段
    public var added: [String] = []
    /// ID 字段 → Anki 的笔记编号
    public var notes: [String: Int] = [:]
    /// 已经有了，没重复加
    public var duplicates: [String] = []
    /// ID 字段 → 为什么没加进去
    public var failed: [String: String] = [:]

    public init() {}
}

public enum Anki {
    public static let connectVersion = 6
    /// AnkiConnect 在 AnkiWeb 上的编号，也是 addons21 下的文件夹名
    public static let addonCode = "2055492159"
    public static let url = URL(string: "http://127.0.0.1:8765")!

    /// 一个请求的 JSON：{action, version: 6, params}，没有参数就不带 params
    public static func requestBody(_ action: String, _ params: [String: Any]? = nil) -> [String: Any] {
        var body: [String: Any] = ["action": action, "version": connectVersion]
        if let params { body["params"] = params }
        return body
    }

    /// AnkiConnect 的英文错误里，常见的换成能看懂的话
    public static func readableError(_ error: String) -> String {
        if error.contains("Close the affected editor") {
            return "Anki 里开着卡片浏览器或「添加」窗口，Anki 不让这时改笔记类型；关掉它再送"
        }
        return error
    }

    /// 读回答：{result, error}。error 不空就抛 .api，不是这个样子抛 .badResponse；result 是 null 回 nil
    public static func readReply(_ json: Any) throws -> Any? {
        guard let dict = json as? [String: Any], let result = dict["result"], let error = dict["error"] else {
            throw CardFamilyError.badResponse
        }
        if let message = error as? String, !message.isEmpty { throw CardFamilyError.api(readableError(message)) }
        return result is NSNull ? nil : result
    }

    /// CSS 第一行（去掉首尾的空格、制表符）`/* 卡片家族 vN */` 里的 N；不是这个格式（你在 Anki 里改过）回 nil
    public static func cssVersion(_ css: String) -> Int? {
        let first = css.components(separatedBy: "\n").first ?? ""
        var v = Substring(first).unicodeScalars
        func blank(_ s: Unicode.Scalar) -> Bool { s == "\t" || s.properties.generalCategory == .spaceSeparator }
        while let f = v.first, blank(f) { v.removeFirst() }
        while let l = v.last, blank(l) { v.removeLast() }
        let line = String(v)
        let head = "/* 卡片家族 v", tail = " */"
        guard line.hasPrefix(head), line.hasSuffix(tail), line.count > head.count + tail.count else { return nil }
        let digits = line.dropFirst(head.count).dropLast(tail.count)
        guard digits.unicodeScalars.allSatisfy({ ("0"..."9").contains($0) }) else { return nil }
        return Int(digits)
    }

    /// 建笔记类型的参数
    public static func createModelParams(_ name: String) -> [String: Any] {
        [
            "modelName": name,
            "inOrderFields": CardSpec.fields,
            "css": CardSpec.css,
            "isCloze": false,
            "cardTemplates": [["Name": CardSpec.templateName, "Front": CardSpec.front, "Back": CardSpec.back]],
        ]
    }

    static func restyle(_ call: AnkiCall, _ name: String) async throws {
        _ = try await call("updateModelStyling", ["model": ["name": name, "css": CardSpec.css]])
        _ = try await call("updateModelTemplates", ["model": [
            "name": name,
            "templates": [CardSpec.templateName: ["Front": CardSpec.front, "Back": CardSpec.back]],
        ]])
    }

    /// 「学习卡 · 问答」缺了就建；Anki 里的版本旧了就换模板和样式；同名的不是我们的就改用「学习卡 · 问答 2」。
    /// 返回要往哪个笔记类型里写。你改过模板又传了 .ask，抛 .customizedStyle
    public static func prepareNoteType(_ call: AnkiCall, customized: CustomizedStyle) async throws -> String {
        guard let names = try await call("modelNames", nil) as? [String] else { throw CardFamilyError.badResponse }
        for name in [CardSpec.name, CardSpec.otherName] {
            guard names.contains(name) else {
                _ = try await call("createModel", createModelParams(name))
                return name
            }
            guard (try await call("modelFieldNames", ["modelName": name]) as? [String]) == CardSpec.fields else { continue }
            let styling = try await call("modelStyling", ["modelName": name]) as? [String: Any]
            if let v = cssVersion(styling?["css"] as? String ?? "") {
                // 只往新的换：Anki 里的比我们带的新（别的软件先更新了），不动
                if v < CardSpec.version { try await restyle(call, name) }
            } else {
                switch customized {
                case .ask: throw CardFamilyError.customizedStyle(model: name)
                case .replace: try await restyle(call, name)
                case .keep: break
                }
            }
            return name
        }
        throw CardFamilyError.namesTaken
    }

    /// 牌组按 id 记：先按 id 找现在叫什么（你在 Anki 里改了名跟着走）；找不到按名字找；还没有就建。返回名字和 id，软件记下 id
    public static func resolveDeck(_ call: AnkiCall, id: Int?, name: String) async throws -> (name: String, id: Int) {
        guard let raw = try await call("deckNamesAndIds", nil) as? [String: Any] else { throw CardFamilyError.badResponse }
        let decks = raw.compactMapValues { ($0 as? NSNumber)?.intValue }
        if let id, let current = decks.first(where: { $0.value == id })?.key { return (current, id) }
        if let existing = decks[name] { return (name, existing) }
        guard let created = (try await call("createDeck", ["deck": name]) as? NSNumber)?.intValue else { throw CardFamilyError.badResponse }
        return (name, created)
    }

    /// addNotes 里一张笔记的 JSON
    public static func noteJSON(_ n: NoteInput, dedupe: DedupeBy) -> [String: Any] {
        let options: [String: Any] = dedupe == .question
            ? ["allowDuplicate": false, "duplicateScope": "deck"]
            : ["allowDuplicate": true]
        return ["deckName": n.deck, "modelName": n.model, "fields": n.fields, "tags": n.tags, "options": options]
    }

    private static let htmlTag = try! NSRegularExpression(pattern: "<[^>]*>")

    /// 判重键：牌组 + 问题（去掉 HTML 标签以后）
    static func batchKey(_ n: NoteInput) -> String {
        n.deck + "\n" + dedupeKey((n.fields["Question"] ?? "").replacing(htmlTag, with: ""))
    }

    /// 送一批卡。笔记类型、牌组要先准备好（prepareNoteType、resolveDeck）
    public static func addNotes(_ call: AnkiCall, _ notes: [NoteInput], dedupe: DedupeBy) async throws -> AddResult {
        var r = AddResult()
        func id(_ n: NoteInput) -> String { n.fields["ID"] ?? "" }
        var fresh: [NoteInput] = []
        switch dedupe {
        case .question:
            var seen = Set<String>()
            var go: [NoteInput] = []
            for n in notes {
                if seen.insert(batchKey(n)).inserted { go.append(n) } else { r.duplicates.append(id(n)) }
            }
            if go.isEmpty { return r }
            guard let checks = try await call("canAddNotesWithErrorDetail", ["notes": go.map { noteJSON($0, dedupe: dedupe) }]) as? [Any],
                  checks.count == go.count else { throw CardFamilyError.badResponse }
            for (n, check) in zip(go, checks) {
                let c = check as? [String: Any]
                let error = c?["error"] as? String ?? ""
                if c?["canAdd"] as? Bool == true {
                    fresh.append(n)
                } else if error.contains("duplicate") {
                    r.duplicates.append(id(n))
                } else {
                    r.failed[id(n)] = error.isEmpty ? "加不进去" : error
                }
            }
        case .id:
            for n in notes {
                guard let found = try await call("findNotes", ["query": "\"ID:\(id(n))\""]) as? [Any] else { throw CardFamilyError.badResponse }
                if found.isEmpty { fresh.append(n) } else { r.duplicates.append(id(n)) }
            }
        }
        if fresh.isEmpty { return r }
        guard let ids = try await call("addNotes", ["notes": fresh.map { noteJSON($0, dedupe: dedupe) }]) as? [Any],
              ids.count == fresh.count else { throw CardFamilyError.badResponse }
        for (n, noteID) in zip(fresh, ids) {
            if let noteID = (noteID as? NSNumber)?.intValue {
                r.added.append(id(n))
                r.notes[id(n)] = noteID
            } else {
                r.failed[id(n)] = "加不进去"
            }
        }
        return r
    }

    /// 卡片浏览器里只看这几张："ID:a" OR "ID:b"
    public static func idQuery(_ ids: [String]) -> String {
        ids.map { "\"ID:\($0)\"" }.joined(separator: " OR ")
    }
}
