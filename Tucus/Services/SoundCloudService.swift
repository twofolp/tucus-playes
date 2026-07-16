import Foundation

final class SoundCloudService {
    static let shared = SoundCloudService()
    private let net = NetworkService.shared
    private var cachedClientId: String?
    private var clientIdExpiry: Date?

    private init() {}

    // MARK: - Client ID

    private func getClientId() async throws -> String {
        if let id = cachedClientId, let expiry = clientIdExpiry, Date() < expiry { return id }

        // Try known fallbacks
        let fallbacks = [
            "a3e059563d7fd3372b49b37f00a00bcf",
            "2t9loNQH90kzJcsF6jGLssKfJaNuISww",
            "b45b1aa10f1ac2941910a7f0d10f8e28"
        ]
        for fb in fallbacks {
            if await validateClientId(fb) {
                cachedClientId = fb
                clientIdExpiry = Date().addingTimeInterval(3600)
                return fb
            }
        }

        // Try scraping
        if let scraped = try? await scrapeClientId() {
            cachedClientId = scraped
            clientIdExpiry = Date().addingTimeInterval(3600)
            return scraped
        }

        throw NetworkError.httpError(0, "Failed to get SoundCloud client ID")
    }

    private func validateClientId(_ clientId: String) async -> Bool {
        let url = "https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id=\(clientId)"
        if let (_, resp) = try? await net.get(url), resp.statusCode == 200 { return true }
        return false
    }

    private func scrapeClientId() async throws -> String? {
        let (htmlData, _) = try await net.get("https://soundcloud.com")
        guard let html = String(data: htmlData, encoding: .utf8) else { return nil }

        let scriptPattern = #/src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"/#
        let scripts = html.matches(of: scriptPattern).map { String($0.1) }.reversed()

        let clientIdPattern = #/client_id:"([a-zA-Z0-9]{32})"/#

        for scriptUrl in scripts {
            if let (jsData, _) = try? await net.get(scriptUrl),
               let js = String(data: jsData, encoding: .utf8),
               let match = js.firstMatch(of: clientIdPattern) {
                let id = String(match.1)
                if await validateClientId(id) { return id }
            }
        }
        return nil
    }

    // MARK: - Search

    func search(query: String) async throws -> [Track] {
        let clientId = try await getClientId()
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let url = "https://api-v2.soundcloud.com/search/tracks?q=\(encoded)&client_id=\(clientId)&limit=20"
        let (data, resp) = try await net.get(url)
        guard resp.statusCode == 200 else { throw NetworkError.httpError(resp.statusCode, "SoundCloud search failed") }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let collection = json?["collection"] as? [[String: Any]] ?? []
        return collection.map { parseTrack($0) }
    }

    // MARK: - Stream URL

    func getStreamUrl(trackId: String) async throws -> String {
        let clientId = try await getClientId()
        let url = "https://api-v2.soundcloud.com/tracks/\(trackId)?client_id=\(clientId)"
        let (data, _) = try await net.get(url)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let transcodings = json?["media"] as? [String: Any]
        let transArr = transcodings?["transcodings"] as? [[String: Any]] ?? []

        guard let transcoding = transArr.first(where: { ($0["format"] as? [String: Any])?["protocol"] as? String == "progressive" })
                ?? transArr.first,
              let streamAuthUrl = transcoding["url"] as? String else {
            throw NetworkError.httpError(0, "No suitable format")
        }

        let streamUrl = "\(streamAuthUrl)?client_id=\(clientId)"
        let (streamData, _) = try await net.get(streamUrl)
        let streamJson = try JSONSerialization.jsonObject(with: streamData) as? [String: Any]
        return streamJson?["url"] as? String ?? streamJson?["location"] as? String ?? ""
    }

    // MARK: - Charts

    func getCharts(genre: String) async throws -> [Track] {
        let clientId = try await getClientId()
        let encoded = genre.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? genre
        let url = "https://api-v2.soundcloud.com/charts?kind=top&genre=soundcloud:genres:\(encoded)&client_id=\(clientId)&limit=10"
        if let (data, resp) = try? await net.get(url), resp.statusCode == 200 {
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let collection = json?["collection"] as? [[String: Any]] ?? []
            let tracks = collection.compactMap { item -> Track? in
                let t = (item["track"] as? [String: Any]) ?? (item["id"] != nil ? item : nil)
                guard let t = t else { return nil }
                let track = parseTrack(t)
                return track.duration > 0 && track.duration <= 600 ? track : nil
            }
            if !tracks.isEmpty { return tracks }
        }
        return try await search(query: "top \(genre)")
    }

    // MARK: - Similar

    func getSimilar(trackId: String) async throws -> [Track] {
        let clientId = try await getClientId()
        let url = "https://api-v2.soundcloud.com/tracks/\(trackId)/related?client_id=\(clientId)&limit=20"
        let (data, resp) = try await net.get(url)
        guard resp.statusCode == 200 else { throw NetworkError.httpError(resp.statusCode, "Related failed") }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let collection = json?["collection"] as? [[String: Any]] ?? []
        return collection.map { parseTrack($0) }
    }

    // MARK: - User Tracks

    func getUserTracks(userId: String) async throws -> [Track] {
        let clientId = try await getClientId()
        let url = "https://api-v2.soundcloud.com/users/\(userId)/tracks?client_id=\(clientId)&limit=20"
        let (data, resp) = try await net.get(url)
        guard resp.statusCode == 200 else { throw NetworkError.httpError(resp.statusCode, "User tracks failed") }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let collection = json?["collection"] as? [[String: Any]] ?? []
        return collection.map { parseTrack($0, artistId: userId) }
    }

    // MARK: - Parse

    private func parseTrack(_ t: [String: Any], artistId: String? = nil) -> Track {
        let id = "\(t["id"] ?? "")"
        let title = t["title"] as? String ?? "Unknown Track"
        let artist = (t["user"] as? [String: Any])?["username"] as? String ?? "Unknown Artist"
        let durationMs = t["duration"] as? Int ?? 0
        let artwork = t["artwork_url"] as? String ?? (t["user"] as? [String: Any])?["avatar_url"] as? String ?? ""
        let thumbnail = artwork.isEmpty ? "" : artwork.replacingOccurrences(of: "-large.", with: "-t500x500.")
        let scArtistId = artistId ?? ((t["user"] as? [String: Any])?["id"] as? Int).map { String($0) }

        return Track(id: id, title: title, artist: artist, artistId: scArtistId, artists: nil,
                     duration: TimeInterval(durationMs / 1000), thumbnail: thumbnail, source: .soundcloud)
    }
}
