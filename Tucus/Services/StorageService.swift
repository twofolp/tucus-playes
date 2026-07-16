import Foundation

final class StorageService {
    static let shared = StorageService()
    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {}

    // MARK: - Yandex Token

    var yandexToken: String {
        get { defaults.string(forKey: "yandex_token") ?? "" }
        set { defaults.set(newValue, forKey: "yandex_token") }
    }

    func cleanYandexToken() -> String {
        var tok = yandexToken.trimmingCharacters(in: .whitespacesAndNewlines)
        if tok.contains("access_token=") {
            if let range = tok.range(of: "access_token=") {
                let afterToken = String(tok[range.upperBound...])
                if let endRange = afterToken.range(of: "&") {
                    tok = String(afterToken[..<endRange.lowerBound])
                } else {
                    tok = afterToken
                }
            }
        }
        return tok
    }

    // MARK: - Liked Tracks

    var likedTracks: [Track] {
        get { load("liked_tracks") ?? [] }
        set { save("liked_tracks", newValue) }
    }

    var dislikedTracks: [Track] {
        get { load("disliked_tracks") ?? [] }
        set { save("disliked_tracks", newValue) }
    }

    func isLiked(_ track: Track) -> Bool {
        likedTracks.contains { $0.id == track.id && $0.source == track.source }
    }

    func isDisliked(_ track: Track) -> Bool {
        dislikedTracks.contains { $0.id == track.id && $0.source == track.source }
    }

    func toggleLike(_ track: Track) -> Bool {
        var tracks = likedTracks
        if let idx = tracks.firstIndex(where: { $0.id == track.id && $0.source == track.source }) {
            tracks.remove(at: idx)
            likedTracks = tracks
            // Also remove from disliked
            dislikedTracks = dislikedTracks.filter { !($0.id == track.id && $0.source == track.source) }
            return false
        } else {
            tracks.insert(track, at: 0)
            if tracks.count > 500 { tracks = Array(tracks.prefix(500)) }
            likedTracks = tracks
            dislikedTracks = dislikedTracks.filter { !($0.id == track.id && $0.source == track.source) }
            return true
        }
    }

    func toggleDislike(_ track: Track) -> Bool {
        var tracks = dislikedTracks
        if let idx = tracks.firstIndex(where: { $0.id == track.id && $0.source == track.source }) {
            tracks.remove(at: idx)
            dislikedTracks = tracks
            likedTracks = likedTracks.filter { !($0.id == track.id && $0.source == track.source) }
            return false
        } else {
            tracks.insert(track, at: 0)
            if tracks.count > 500 { tracks = Array(tracks.prefix(500)) }
            dislikedTracks = tracks
            likedTracks = likedTracks.filter { !($0.id == track.id && $0.source == track.source) }
            return true
        }
    }

    // MARK: - Playlists

    var playlists: [String: [Track]] {
        get { load("playlists") ?? [:] }
        set { save("playlists", newValue) }
    }

    func addToPlaylist(_ name: String, track: Track) {
        var pls = playlists
        var tracks = pls[name] ?? []
        if !tracks.contains(where: { $0.id == track.id && $0.source == track.source }) {
            tracks.append(track)
            pls[name] = tracks
            playlists = pls
        }
    }

    func createPlaylist(_ name: String) {
        var pls = playlists
        if pls[name] == nil { pls[name] = [] }
        playlists = pls
    }

    func deletePlaylist(_ name: String) {
        var pls = playlists
        pls.removeValue(forKey: name)
        playlists = pls
    }

    // MARK: - Recently Played

    var recentlyPlayed: [Track] {
        get { load("recently_played") ?? [] }
        set {
            var tracks = newValue
            if tracks.count > 50 { tracks = Array(tracks.prefix(50)) }
            save("recently_played", tracks)
        }
    }

    func addToRecentlyPlayed(_ track: Track) {
        var tracks = recentlyPlayed
        tracks.removeAll { $0.id == track.id && $0.source == track.source }
        tracks.insert(track, at: 0)
        recentlyPlayed = tracks
    }

    // MARK: - Play History

    var playHistory: [Track] {
        get { load("play_history") ?? [] }
        set { save("play_history", newValue) }
    }

    // MARK: - Settings

    var autoFetchLyrics: Bool {
        get { defaults.object(forKey: "auto_fetch_lyrics") as? Bool ?? true }
        set { defaults.set(newValue, forKey: "auto_fetch_lyrics") }
    }

    var showTranslation: Bool {
        get { defaults.object(forKey: "lyrics_translation_enabled") as? Bool ?? false }
        set { defaults.set(newValue, forKey: "lyrics_translation_enabled") }
    }

    var lyricsFontSize: String {
        get { defaults.string(forKey: "lyrics_font_size") ?? "md" }
        set { defaults.set(newValue, forKey: "lyrics_font_size") }
    }

    var theme: String {
        get { defaults.string(forKey: "app_theme") ?? "dark" }
        set { defaults.set(newValue, forKey: "app_theme") }
    }

    // MARK: - EQ

    var eqGains: [Float] {
        get { load("eq_gains") ?? [0, 0, 0, 0, 0] }
        set { save("eq_gains", newValue) }
    }

    var eqPreset: String {
        get { defaults.string(forKey: "eq_preset") ?? "Flat" }
        set { defaults.set(newValue, forKey: "eq_preset") }
    }

    var useEqualizer: Bool {
        get { defaults.bool(forKey: "use_equalizer") }
        set { defaults.set(newValue, forKey: "use_equalizer") }
    }

    // MARK: - Private

    private func save<T: Encodable>(_ key: String, _ value: T) {
        if let data = try? encoder.encode(value) {
            defaults.set(data, forKey: key)
        }
    }

    private func load<T: Decodable>(_ key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }
}
