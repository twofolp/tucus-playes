import Foundation
import CommonCrypto

final class YandexMusicService {
    static let shared = YandexMusicService()
    private let net = NetworkService.shared
    private let base = "https://api.music.yandex.net"

    private init() {}

    private func headers(_ token: String) -> [String: String] {
        [
            "Authorization": "OAuth \(token)",
            "User-Agent": "Yandex-Music-API/2.0",
            "X-Yandex-Music-Client": "YandexMusicAPI/2.0",
            "Accept": "application/json",
            "Accept-Language": "ru,en"
        ]
    }

    // MARK: - Search

    func search(query: String, token: String) async throws -> [Track] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let url = "\(base)/search?text=\(encoded)&type=track&page=0&pageSize=20"
        let (data, resp) = try await net.get(url, headers: headers(token))
        guard resp.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw NetworkError.httpError(resp.statusCode, String(body.prefix(200)))
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let results = json?["result"] as? [String: Any]
        let tracksObj = results?["tracks"] as? [String: Any]
        let items = (tracksObj?["results"] as? [[String: Any]]) ?? (tracksObj?["items"] as? [[String: Any]]) ?? []
        return items.compactMap { parseTrack($0) }
    }

    func searchAll(query: String, token: String) async throws -> SearchResult {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let url = "\(base)/search?text=\(encoded)&type=all&page=0&pageSize=20"
        let (data, resp) = try await net.get(url, headers: headers(token))
        guard resp.statusCode == 200 else { throw NetworkError.httpError(resp.statusCode, "Search failed") }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let result = json?["result"] as? [String: Any]

        let tracks = (result?["tracks"] as? [String: Any])
            .flatMap { ($0["results"] as? [[String: Any]]) ?? ($0["items"] as? [[String: Any]]) } ?? []
        let albums = (result?["albums"] as? [String: Any])
            .flatMap { ($0["results"] as? [[String: Any]]) ?? ($0["items"] as? [[String: Any]]) } ?? []
        let artists = (result?["artists"] as? [String: Any])
            .flatMap { ($0["results"] as? [[String: Any]]) ?? ($0["items"] as? [[String: Any]]) } ?? []

        return SearchResult(
            tracks: tracks.compactMap { parseTrack($0) },
            albums: albums.compactMap { parseAlbum($0) },
            artists: artists.compactMap { parseArtist($0) }
        )
    }

    // MARK: - Stream URL

    func getStreamUrl(trackId: String, token: String) async throws -> String {
        let infoUrl = "\(base)/tracks/\(trackId)/download-info"
        let (infoData, _) = try await net.get(infoUrl, headers: headers(token))
        let infoJson = try JSONSerialization.jsonObject(with: infoData) as? [String: Any]
        let result = infoJson?["result"] as? [[String: Any]]

        guard let info = result?.first(where: { ($0["codec"] as? String) == "mp3" }) ?? result?.first,
              let downloadInfoUrl = info["downloadInfoUrl"] as? String else {
            throw NetworkError.httpError(0, "No download info")
        }

        let (xmlData, _) = try await net.get(downloadInfoUrl, headers: headers(token))
        guard let xml = String(data: xmlData, encoding: .utf8) else { throw NetworkError.invalidResponse }

        guard let host = extractTag(xml, "host"),
              let path = extractTag(xml, "path"),
              let ts = extractTag(xml, "ts"),
              let s = extractTag(xml, "s") else {
            throw NetworkError.httpError(0, "Failed to parse XML")
        }

        let pathClean = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let hashInput = "XGRlBW9FXlekgbPrRHuSiA\(pathClean)\(s)"
        let hash = md5Hash(hashInput)
        let cleanPath = path.hasPrefix("/") ? path : "/\(path)"
        return "https://\(host)/get-mp3/\(hash)/\(ts)\(cleanPath)"
    }

    // MARK: - Playlists

    func getPlaylist(owner: String, playlistId: String, token: String) async throws -> PlaylistInfo {
        let url = "\(base)/users/\(owner)/playlists/\(playlistId)"
        var h = headers(token)
        h["X-Yandex-Music-Client"] = "YandexMusic/Android"
        let (data, _) = try await net.get(url, headers: h)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let result = json?["result"] as? [String: Any] ?? [:]

        let title = result["title"] as? String ?? "Playlist"
        let ownerName = (result["owner"] as? [String: Any])?["name"] as? String ?? "Yandex Music"
        let coverUri = (result["cover"] as? [String: Any])?["uri"] as? String ?? ""
        let coverUrl = coverUri.isEmpty ? "" : "https://\(coverUri.replacingOccurrences(of: "%%", with: "400x400"))"
        let trackCount = result["trackCount"] as? Int ?? 0

        let tracksSource = (result["tracks"] as? [[String: Any]]) ?? (result["items"] as? [[String: Any]]) ?? []
        let tracks = tracksSource.compactMap { item -> Track? in
            guard let trackObj = item["track"] as? [String: Any] else { return nil }
            return parseTrack(trackObj)
        }

        return PlaylistInfo(title: title, ownerName: ownerName, coverUrl: coverUrl, trackCount: trackCount, tracks: tracks)
    }

    func getLikedTracks(token: String) async throws -> [Track] {
        let uid = try await getUid(token: token)
        let url = "\(base)/users/\(uid)/likes/tracks"
        let (data, _) = try await net.get(url, headers: headers(token))
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let result = json?["result"] as? [String: Any]
        let library = result?["library"] as? [String: Any]
        let tracks = library?["tracks"] as? [[String: Any]] ?? []

        var resultTracks: [Track] = []
        for item in tracks.prefix(50) {
            if let id = item["id"] as? String {
                let trackUrl = "\(base)/tracks/\(id)"
                if let (tData, _) = try? await net.get(trackUrl, headers: headers(token)),
                   let tJson = try? JSONSerialization.jsonObject(with: tData) as? [String: Any],
                   let tResult = tJson["result"] as? [[String: Any]],
                   let first = tResult.first {
                    if let track = parseTrack(first) {
                        resultTracks.append(track)
                    }
                }
            }
        }
        return resultTracks
    }

    // MARK: - My Wave

    func getMyWave(token: String) async throws -> [Track] {
        let url = "\(base)/rotor/station/user:onyourwave/tracks"
        let (data, _) = try await net.get(url, headers: headers(token))
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let result = json?["result"] as? [String: Any]
        let sequence = result?["sequence"] as? [[String: Any]] ?? []
        return sequence.compactMap { item in
            guard let trackObj = item["track"] as? [String: Any] else { return nil }
            return parseTrack(trackObj)
        }
    }

    // MARK: - Similar

    func getSimilar(trackId: String, token: String) async throws -> [Track] {
        let url = "\(base)/tracks/\(trackId)/similar"
        let (data, _) = try await net.get(url, headers: headers(token))
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let similar = (json?["result"] as? [String: Any])?["similarTracks"] as? [[String: Any]] ?? []
        return similar.compactMap { parseTrack($0) }
    }

    // MARK: - Like/Dislike

    func likeTrack(trackId: String, token: String, remove: Bool) async throws {
        let uid = try await getUid(token: token)
        let url = "\(base)/users/\(uid)/likes/tracks/add-multiple"
        let body = try JSONSerialization.data(withJSONObject: ["track-ids": [trackId]])
        if remove {
            let removeUrl = "\(base)/users/\(uid)/likes/tracks/remove"
            _ = try await net.post(removeUrl, body: body, headers: headers(token))
        } else {
            _ = try await net.post(url, body: body, headers: headers(token))
        }
    }

    // MARK: - Lyrics

    func getLyrics(trackId: String, token: String) async throws -> [LyricLine] {
        let urls = [
            "\(base)/tracks/\(trackId)/lyrics?format=LRC&timeStamped=true",
            "\(base)/tracks/\(trackId)/supplement"
        ]
        for url in urls {
            if let (data, resp) = try? await net.get(url, headers: headers(token)), resp.statusCode == 200 {
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                if let downloadUrl = findDownloadUrl(json) {
                    if let (lrcData, _) = try? await net.get(downloadUrl),
                       let lrcText = String(data: lrcData, encoding: .utf8) {
                        let lines = LRCParser.parse(lrcText)
                        if !lines.isEmpty { return lines }
                    }
                }
                if let fullLyrics = findFullLyrics(json) {
                    let lines = LRCParser.parse(fullLyrics)
                    if !lines.isEmpty { return lines }
                    return fullLyrics.components(separatedBy: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                        .map { LyricLine(time: nil, duration: nil, text: $0) }
                }
            }
        }
        throw NetworkError.httpError(0, "Lyrics not found")
    }

    // MARK: - Helpers

    private func getUid(token: String) async throws -> String {
        let (data, _) = try await net.get("\(base)/account/status", headers: headers(token))
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let result = json?["result"] as? [String: Any]
        let account = result?["account"] as? [String: Any]
        guard let uid = account?["uid"] as? Int else { throw NetworkError.httpError(0, "Failed to get UID") }
        return String(uid)
    }

    private func findDownloadUrl(_ json: [String: Any]?) -> String? {
        guard let json = json else { return nil }
        if let result = json["result"] as? [String: Any] {
            if let lyrics = result["lyrics"] as? [String: Any], let url = lyrics["downloadUrl"] as? String { return url }
            if let url = result["downloadUrl"] as? String { return url }
        }
        if let lyrics = json["lyrics"] as? [String: Any], let url = lyrics["downloadUrl"] as? String { return url }
        return nil
    }

    private func findFullLyrics(_ json: [String: Any]?) -> String? {
        guard let json = json else { return nil }
        if let result = json["result"] as? [String: Any] {
            if let lyrics = result["lyrics"] as? [String: Any] {
                return lyrics["fullLyrics"] as? String ?? lyrics["text"] as? String
            }
            return result["fullLyrics"] as? String ?? result["text"] as? String
        }
        return (json["lyrics"] as? [String: Any])?["fullLyrics"] as? String
    }

    private func extractTag(_ xml: String, _ tag: String) -> String? {
        guard let startRange = xml.range(of: "<\(tag)>"),
              let endRange = xml.range(of: "</\(tag)>", range: startRange.upperBound..<xml.endIndex) else {
            return nil
        }
        return String(xml[startRange.upperBound..<endRange.lowerBound])
    }

    private func md5Hash(_ string: String) -> String {
        let data = Data(string.utf8)
        var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
        data.withUnsafeBytes { _ = CC_MD5($0.baseAddress, CC_LONG(data.count), &digest) }
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    func parseTrack(_ t: [String: Any]) -> Track? {
        let id: String
        if let idNum = t["id"] as? Int { id = String(idNum) }
        else if let idStr = t["id"] as? String { id = idStr }
        else { return nil }
        guard !id.isEmpty else { return nil }

        let title = t["title"] as? String ?? "Unknown"
        let artists = t["artists"] as? [[String: Any]] ?? []
        let artistsCompact = artists.compactMap { a -> Track.ArtistCompact? in
            guard let name = a["name"] as? String else { return nil }
            let aId: String
            if let idNum = a["id"] as? Int { aId = String(idNum) }
            else if let idStr = a["id"] as? String { aId = idStr }
            else { aId = "" }
            return Track.ArtistCompact(id: aId, name: name)
        }
        let artist = artistsCompact.map(\.name).joined(separator: ", ")
        let artistId = artistsCompact.first?.id
        let durationMs = t["durationMs"] as? Int ?? 0
        let coverUri = t["coverUri"] as? String ?? ""
        let thumbnail = coverUri.isEmpty ? "" : "https://\(coverUri.replacingOccurrences(of: "%%", with: "400x400"))"

        return Track(id: id, title: title, artist: artist.isEmpty ? "Unknown Artist" : artist,
                     artistId: artistId, artists: artistsCompact.isEmpty ? nil : artistsCompact,
                     duration: TimeInterval(durationMs / 1000), thumbnail: thumbnail, source: .yandex)
    }

    func parseAlbum(_ a: [String: Any]) -> Album? {
        let id: String
        if let idNum = a["id"] as? Int { id = String(idNum) }
        else if let idStr = a["id"] as? String { id = idStr }
        else { return nil }

        let title = a["title"] as? String ?? "Unknown Album"
        let coverUri = a["coverUri"] as? String ?? ""
        let thumbnail = coverUri.isEmpty ? "" : "https://\(coverUri.replacingOccurrences(of: "%%", with: "400x400"))"
        let artists = a["artists"] as? [[String: Any]] ?? []
        let artist = artists.compactMap { $0["name"] as? String }.joined(separator: ", ")
        let artistId: String? = artists.first.flatMap { a in
            if let idNum = a["id"] as? Int { return String(idNum) }
            return a["id"] as? String
        }
        let trackCount = a["trackCount"] as? Int ?? 0
        let year = a["year"] as? Int
        let albumType = a["type"] as? String

        return Album(id: id, title: title, thumbnail: thumbnail, artist: artist.isEmpty ? "Unknown" : artist,
                     artistId: artistId, trackCount: trackCount, year: year, albumType: albumType)
    }

    func parseArtist(_ a: [String: Any]) -> Artist? {
        let id: String
        if let idNum = a["id"] as? Int { id = String(idNum) }
        else if let idStr = a["id"] as? String { id = idStr }
        else { return nil }

        let name = a["name"] as? String ?? "Unknown"
        let cover = a["cover"] as? [String: Any]
        let coverUri = cover?["uri"] as? String ?? (a["coverUri"] as? String ?? "")
        let thumbnail = coverUri.isEmpty ? "" : "https://\(coverUri.replacingOccurrences(of: "%%", with: "400x400"))"
        let genres = (a["genres"] as? [[String: Any]])?.compactMap { $0["name"] as? String } ?? []

        return Artist(id: id, name: name, thumbnail: thumbnail, genres: genres)
    }
}
