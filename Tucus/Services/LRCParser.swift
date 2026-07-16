import Foundation

struct LRCParser {
    static func parse(_ text: String) -> [LyricLine] {
        let lineTimePattern = /\[(\d+):(\d+)[.:](\d+)\]/
        let plainTimePattern = /\[(\d+):(\d+)\]/
        let wordTagPattern = /<(\d+):(\d+)[.:](\d+)>/

        var lines: [LyricLine] = []

        for rawLine in text.components(separatedBy: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }

            // Skip metadata tags [ti:...] [ar:...] [al:...]
            if line.hasPrefix("[") && !line.contains("]:") && !line.contains("].") {
                // Check if it's actually a timestamp
                if !(try? line.wholeMatch(of: lineTimePattern)) != nil ||
                   !(try? line.wholeMatch(of: plainTimePattern)) != nil {
                    // It's a metadata tag, skip
                    if line.hasPrefix("[ti:") || line.hasPrefix("[ar:") || line.hasPrefix("[al:") ||
                       line.hasPrefix("[by:") || line.hasPrefix("[re:") || line.hasPrefix("[ve:") {
                        continue
                    }
                }
            }

            // Find all line-level timestamps
            var timeMatches: [(min: String, sec: String, cs: String)] = []
            var tempLine = line

            while let match = tempLine.firstMatch(of: lineTimePattern) {
                timeMatches.append((String(match.1), String(match.2), String(match.3)))
                tempLine = String(tempLine[match.range.upperBound...])
            }

            if timeMatches.isEmpty {
                // Try plain format [MM:SS]
                if let match = line.firstMatch(of: plainTimePattern) {
                    let min = Int(match.1) ?? 0
                    let sec = Int(match.2) ?? 0
                    let content = String(line[match.range.upperBound...]).trimmingCharacters(in: .whitespaces)
                    if !content.isEmpty {
                        lines.append(LyricLine(time: TimeInterval(min * 60 + sec), duration: nil, text: content))
                    }
                } else if !line.hasPrefix("[") {
                    lines.append(LyricLine(time: nil, duration: nil, text: line))
                }
                continue
            }

            // Get content after removing line timestamps
            var content = line
            for match in line.matches(of: lineTimePattern) {
                content = content.replacingOccurrences(of: String(match.0), with: "")
            }
            content = content.trimmingCharacters(in: .whitespaces)

            // Check for word-level timestamps
            var syllables: [Syllable] = []
            var cleanContent = content
            var currentWordTime: TimeInterval = 0

            if let wordMatch = content.firstMatch(of: wordTagPattern) {
                var lastEnd = content.startIndex
                for wm in content.matches(of: wordTagPattern) {
                    let preText = String(content[lastEnd..<wm.range.lowerBound])
                    if !preText.isEmpty {
                        syllables.append(Syllable(text: preText, time: currentWordTime, duration: 0))
                    }

                    let min = Double(wm.1) ?? 0
                    let sec = Double(wm.2) ?? 0
                    let csStr = String(wm.3)
                    let csVal = Double(csStr) ?? 0
                    let ms: Double
                    switch csStr.count {
                    case 1: ms = csVal * 100
                    case 2: ms = csVal * 10
                    default: ms = csVal
                    }
                    currentWordTime = min * 60 + sec * 1 + ms / 1000
                    lastEnd = wm.range.upperBound
                }
                let tail = String(content[lastEnd...])
                if !tail.isEmpty {
                    syllables.append(Syllable(text: tail, time: currentWordTime, duration: 0))
                }
                cleanContent = content.replacingOccurrences(of: #"<\d+:\d+[.:]\d+>"#, with: "", options: .regularExpression)
                    .trimmingCharacters(in: .whitespaces)
            }

            // Create a line for each timestamp
            for tm in timeMatches {
                let min = Double(tm.min) ?? 0
                let sec = Double(tm.sec) ?? 0
                let csStr = tm.cs
                let csVal = Double(csStr) ?? 0
                let ms: Double
                switch csStr.count {
                case 1: ms = csVal * 100
                case 2: ms = csVal * 10
                default: ms = csVal
                }
                let lineTime = min * 60 + sec + ms / 1000

                let lineSyllables = syllables.map { s -> Syllable in
                    Syllable(text: s.text, time: s.time == 0 ? lineTime : s.time, duration: s.duration)
                }

                lines.append(LyricLine(time: lineTime, duration: nil, text: cleanContent, syllables: lineSyllables))
            }
        }

        // Calculate durations
        for i in 0..<lines.count {
            if let time = lines[i].time {
                let duration: TimeInterval
                if i + 1 < lines.count {
                    duration = (lines[i + 1].time ?? (time + 5)) - time
                } else {
                    duration = 5
                }
                lines[i] = LyricLine(id: lines[i].id, time: time, duration: duration,
                                     text: lines[i].text, syllables: lines[i].syllables)
            }
        }

        return lines
    }
}
