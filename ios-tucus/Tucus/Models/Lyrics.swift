import Foundation

struct LyricLine: Identifiable, Codable {
    let id: UUID
    let time: TimeInterval?
    let duration: TimeInterval?
    let text: String
    let syllables: [Syllable]
    var translation: String?

    init(id: UUID = UUID(), time: TimeInterval?, duration: TimeInterval?, text: String, syllables: [Syllable] = [], translation: String? = nil) {
        self.id = id
        self.time = time
        self.duration = duration
        self.text = text
        self.syllables = syllables
        self.translation = translation
    }
}

struct Syllable: Codable {
    let text: String
    let time: TimeInterval
    let duration: TimeInterval
}
