// swift-tools-version: 6.0
// 卡片家族的 Swift 包：ChatCards、Ask Free、GetNewWord（Mac）和以后的 iPad 版直接引这个仓库
import PackageDescription

let package = Package(
    name: "CardFamily",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "CardFamily", targets: ["CardFamily"]),
    ],
    targets: [
        .target(name: "CardFamily", path: "packages/swift/Sources/CardFamily"),
        .testTarget(name: "CardFamilyTests", dependencies: ["CardFamily"], path: "packages/swift/Tests/CardFamilyTests"),
    ],
    swiftLanguageModes: [.v5]
)
