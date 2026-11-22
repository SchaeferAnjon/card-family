// 包里的规范常量要和 spec/ 原文一样（改了 spec/ 没跑 npm run gen，这里不过）
import CardFamily
import Foundation
import Testing

func specText(_ path: String) -> String {
    try! String(contentsOf: repo.appendingPathComponent("spec/" + path), encoding: .utf8)
}

@Test func noteTypeMatchesSpec() {
    let nt = load("spec/notetype.json") as! [String: Any]
    #expect(CardSpec.name == nt["name"] as! String)
    #expect(CardSpec.otherName == nt["otherName"] as! String)
    #expect(CardSpec.templateName == nt["templateName"] as! String)
    #expect(CardSpec.version == nt["version"] as! Int)
    #expect(CardSpec.fields == (nt["fields"] as! [[String: Any]]).map { $0["name"] as! String })
    let files = nt["templates"] as! [String: String]
    #expect(CardSpec.front + "\n" == specText(files["front"]!))
    #expect(CardSpec.back + "\n" == specText(files["back"]!))
    #expect(CardSpec.css + "\n" == specText(files["css"]!))
    #expect(Anki.cssVersion(CardSpec.css) == CardSpec.version)
}

@Test func rulesMatchSpec() throws {
    let md = specText("rules.zh.md")
    #expect(CardSpec.cardRules.count == 6)
    for r in CardSpec.cardRules { #expect(md.contains("\n- \(r)\n")) }
    #expect(md.contains("```json\n\(CardSpec.outputFormat)\n```"))
    #expect(CardSpec.rulesPrompt == "卡片的写法：\n" + CardSpec.cardRules.map { "- \($0)" }.joined(separator: "\n") + "\n\n只输出 JSON，格式：\n" + CardSpec.outputFormat)
    let format = try JSONSerialization.jsonObject(with: Data(CardSpec.outputFormat.utf8)) as? [String: Any]
    #expect(format?["cards"] is [Any])
}
