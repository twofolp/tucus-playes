import Foundation

final class LyricsService {
    static let shared = LyricsService()
    private let net = NetworkService.shared

    private init() {}

    func fetchLyrics(track: Track, yandexToken: String?) async -> [LyricLine] {
        // 1. Try Yandex lyrics first
        if track.source == .yandex, let token = yandexToken, !token.isEmpty {
            if let lines = try? await YandexMusicService.shared.getLyrics(trackId: track.id, token: token),
               !lines.isEmpty {
                return lines
            }
        }

        // 2. Try LRCLIB
        if let lines = try? await fetchFromLRCLIB(track: track), !lines.isEmpty {
            return lines
        }

        return []
    }

    private func fetchFromLRCLIB(track: Track) async throws -> [LyricLine] {
        let cleanArtist = cleanMetadata(track.artist)
        let cleanTitle = cleanMetadata(track.title)

        // Exact match
        if let lines = try? await lrclibExact(artist: cleanArtist, title: cleanTitle, duration: track.duration),
           !lines.isEmpty {
            return lines
        }

        // Search fallback
        if let lines = try? await lrclibSearch(artist: cleanArtist, title: cleanTitle, duration: track.duration),
           !lines.isEmpty {
            return lines
        }

        return []
    }

    private func lrclibExact(artist: String, title: String, duration: TimeInterval?) async throws -> [LyricLine]? {
        var url = "https://lrclib.net/api/get?artist_name=\(encoded(artist))&track_name=\(encoded(title))"
        if let d = duration { url += "&duration=\(Int(d))" }
        let (data, resp) = try await net.get(url, headers: ["User-Agent": "TucusiOS/1.0"])
        guard resp.statusCode == 200 else { return nil }
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        return parseLRCLIBResponse(json)
    }

    private func lrclibSearch(artist: String, title: String, duration: TimeInterval?) async throws -> [LyricLine]? {
        let query = "\(artist) \(title)"
        let url = "https://lrclib.net/api/search?q=\(encoded(query))"
        let (data, resp) = try await net.get(url, headers: ["User-Agent": "TucusiOS/1.0"])
        guard resp.statusCode == 200 else { return nil }
        let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        guard let results = json, !results.isEmpty else { return nil }

        let queryArtist = artist.lowercased().replacingOccurrences(of: " ", with: "")
        let targetDur = duration.map { Int($0) }

        var best: [String: Any]?
        var bestScore = -1

        for item in results {
            var score = 0
            if let itemArtist = item["artistName"] as? String {
                let norm = itemArtist.lowercased().replacingOccurrences(of: " ", with: "")
                if norm.contains(queryArtist) || queryArtist.contains(norm) { score += 100 }
            }
            if let itemDur = item["duration"] as? Double, let target = targetDur {
                let diff = abs(Int(itemDur) - target)
                if diff <= 3 { score += 200 }
                else if diff <= 10 { score += 100 }
            }
            if let synced = item["syncedLyrics"] as? String, !synced.isEmpty { score += 30 }
            if score > bestScore { bestScore = score; best = item }
        }

        return parseLRCLIBResponse(best)
    }

    private func parseLRCLIBResponse(_ json: [String: Any]?) -> [LyricLine]? {
        guard let json = json else { return nil }
        if let synced = json["syncedLyrics"] as? String, !synced.isEmpty {
            let lines = LRCParser.parse(synced)
            if !lines.isEmpty { return lines }
        }
        if let plain = json["plainLyrics"] as? String, !plain.isEmpty {
            let lines = plain.components(separatedBy: "\n")
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                .map { LyricLine(time: nil, duration: nil, text: $0) }
            if !lines.isEmpty { return lines }
        }
        return nil
    }

    private func cleanMetadata(_ s: String) -> String {
        var result = s
        result = result.replacingOccurrences(of: #"(?i)\b(feat|ft|prod|with)\b.*"#, with: "", options: .regularExpression)
        result = result.replacingOccurrences(of: #"\s*[\(\[][^\)]*[\)\]]"#, with: "", options: .regularExpression)
        result = result.replacingOccurrences(of: #"[^\w\s']"#, with: " ", options: .regularExpression)
        result = result.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return result.trimmingCharacters(in: .whitespaces)
    }

    func translateLyrics(_ lines: [LyricLine], to lang: String = "ru") async -> [LyricLine] {
        let text = lines.map { $0.text }.joined(separator: "\n")
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return lines }

        let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? text
        let url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=\(lang)&dt=t&q=\(encoded)"
        guard let (data, _) = try? await net.get(url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let first = json.first as? [[Any]] else {
            return lines
        }

        let translated = first.compactMap { $0.first as? String }.joined(separator: "\n")
        let translatedLines = translated.components(separatedBy: "\n")

        return lines.enumerated().map { idx, line in
            var l = line
            l.translation = idx < translatedLines.count ? translatedLines[idx] : nil
            return l
        }
    }

    private func encoded(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? s
    }
}
