// 读 fixtures/ 里的共用样例：TS 包的测试读的是同一批，两边结果必须一样
import CardFamily
import Foundation
import Testing

/// 仓库根目录：这个文件在 packages/swift/Tests/CardFamilyTests/ 下
let repo = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../..").standardizedFileURL

func load(_ path: String) -> Any {
    try! JSONSerialization.jsonObject(with: Data(contentsOf: repo.appendingPathComponent(path)), options: [.fragmentsAllowed])
}

func cases(_ name: String) -> [[String: Any]] {
    (load("fixtures/" + name) as! [String: Any])["cases"] as! [[String: Any]]
}

/// 两份 JSON 一样不一样：都用同一个序列化排好键再比
func json(_ value: Any?) -> String {
    let data = try! JSONSerialization.data(withJSONObject: value ?? NSNull(), options: [.sortedKeys, .fragmentsAllowed, .withoutEscapingSlashes])
    return String(decoding: data, as: UTF8.self)
}

func decode<T: Decodable>(_ type: T.Type, _ value: Any) -> T {
    try! JSONDecoder().decode(T.self, from: JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]))
}

/// 给 @Test(arguments:) 用：带名字，失败时看得出是哪一条
struct Case: CustomTestStringConvertible, @unchecked Sendable {
    let name: String
    let data: [String: Any]
    var testDescription: String { name }
}

func named(_ file: String, _ title: ([String: Any]) -> String) -> [Case] {
    cases(file).map { Case(name: title($0), data: $0) }
}

@Test(arguments: named("text.json") { "\($0["fn"]!)(\(json($0["input"])))" })
func text(_ c: Case) {
    let input = c.data["input"]!
    let s = input as? String ?? ""
    let list = input as? [String] ?? []
    let got: Any? = switch c.data["fn"] as! String {
    case "escapeHTML": CardHTML.escape(s)
    case "textHTML": CardHTML.text(s)
    case "pointsHTML": CardHTML.points(s)
    case "numberedHTML": CardHTML.numbered(s)
    case "dedupeKey": dedupeKey(s)
    case "tagSafe": CardTags.safe(s)
    case "fromTag": CardTags.from(s)
    case "topicTag": CardTags.topic(s)
    case "deckName": Decks.name(list)
    case "idQuery": Anki.idQuery(list)
    case "cssVersion": Anki.cssVersion(s)
    case "readableError": Anki.readableError(s)
    case "fieldIsEmpty": CardPreview.fieldIsEmpty(s)
    case let fn: Issue.record("Swift 包里没有 \(fn)")
    }
    #expect(json(got) == json(c.data["expect"]))
}

@Test(arguments: named("cards.json") { $0["name"] as! String })
func cards(_ c: Case) {
    let fields = decode(StudyCardInput.self, c.data["input"]!).fields
    #expect(fields == c.data["fields"] as! [String: String])
    #expect(checkFields(fields).missing.isEmpty && checkFields(fields).extra.isEmpty)
    #expect(CardPreview.card(.front, fields: fields) == c.data["front"] as! String)
    #expect(CardPreview.card(.back, fields: fields) == c.data["back"] as! String)
}

@Test(arguments: named("preview.json") { "\($0["side"]!) dark=\($0["dark"]!)" })
func preview(_ c: Case) {
    let side = CardPreview.Side(rawValue: c.data["side"] as! String)!
    #expect(CardPreview.page(side, fields: c.data["fields"] as! [String: String], dark: c.data["dark"] as! Bool) == c.data["expect"] as! String)
}

@Test func requests() {
    let r = load("fixtures/requests.json") as! [String: Any]
    for c in r["requestBody"] as! [[String: Any]] {
        #expect(json(Anki.requestBody(c["action"] as! String, c["params"] as? [String: Any])) == json(c["expect"]))
    }
    for c in r["createModelParams"] as! [[String: Any]] {
        #expect(json(Anki.createModelParams(c["name"] as! String)) == json(c["expect"]))
    }
    for c in r["noteJSON"] as! [[String: Any]] {
        let note = decode(NoteInput.self, c["note"]!)
        #expect(json(Anki.noteJSON(note, dedupe: DedupeBy(rawValue: c["dedupe"] as! String)!)) == json(c["expect"]))
    }
    for c in r["readReply"] as! [[String: Any]] {
        do {
            let got = try Anki.readReply(c["reply"]!)
            #expect(c["error"] == nil)
            #expect(json(got) == json(c["expect"]))
        } catch let e as CardFamilyError {
            #expect(kind(e) == c["error"] as? String)
            #expect(e.errorDescription == c["message"] as? String)
        } catch {
            Issue.record(error)
        }
    }
}

func kind(_ e: CardFamilyError) -> String {
    switch e {
    case .api: "api"
    case .badResponse: "bad-response"
    case .customizedStyle: "customized-style"
    case .namesTaken: "names-taken"
    }
}

/// 按 steps 回答的假 Anki：核对每一步发的请求，回写好的回答
final class Script: @unchecked Sendable {
    let name: String
    let steps: [[String: Any]]
    var at = 0
    init(_ name: String, _ steps: [[String: Any]]) {
        self.name = name
        self.steps = steps
    }

    func call(_ action: String, _ params: [String: Any]?) async throws -> Any? {
        guard at < steps.count else {
            Issue.record("\(name)：多发了 \(action)")
            throw CardFamilyError.badResponse
        }
        let step = steps[at]
        at += 1
        #expect(json(Anki.requestBody(action, params)) == json(step["request"]), "\(name)：第 \(at) 步")
        return try Anki.readReply(step["reply"]!)
    }
}

@Test(arguments: named("sessions.json") { "\($0["op"]!)：\($0["name"]!)" })
func sessions(_ c: Case) async throws {
    let script = Script(c.name, c.data["steps"] as! [[String: Any]])
    let args = c.data["args"] as! [Any]
    let call: AnkiCall = { try await script.call($0, $1) }
    do {
        let got: Any
        switch c.data["op"] as! String {
        case "prepareNoteType":
            got = try await Anki.prepareNoteType(call, customized: CustomizedStyle(rawValue: args[0] as! String)!)
        case "resolveDeck":
            let deck = args[0] as! [String: Any]
            let r = try await Anki.resolveDeck(call, id: (deck["id"] as? NSNumber)?.intValue, name: deck["name"] as! String)
            got = ["name": r.name, "id": r.id]
        case "addNotes":
            let r = try await Anki.addNotes(call, decode([NoteInput].self, args[0]), dedupe: DedupeBy(rawValue: args[1] as! String)!)
            got = try JSONSerialization.jsonObject(with: JSONEncoder().encode(r))
        case let op:
            Issue.record("Swift 包里没有 \(op)")
            return
        }
        #expect(c.data["error"] == nil, "应该抛错")
        #expect(json(got) == json(c.data["expect"]))
    } catch let e as CardFamilyError {
        let expected = c.data["error"] as? [String: Any]
        #expect(kind(e) == expected?["kind"] as? String)
        #expect(e.errorDescription == expected?["message"] as? String)
        if case .customizedStyle(let model) = e { #expect(model == expected?["model"] as? String) }
    }
    #expect(script.at == script.steps.count, "少发了请求")
}
