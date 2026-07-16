import Foundation

struct Track: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let artist: String
    let artistId: String?
    let artists: [ArtistCompact]?
    let duration: TimeInterval
    let thumbnail: String
    let source: TrackSource
    var streamUrl: String?

    enum TrackSource: String, Codable, CaseIterable {
        case youtube
        case yandex
        case soundcloud
    }

    struct ArtistCompact: Codable, Hashable {
        let id: String
        let name: String
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(source)
    }

    static func == (lhs: Track, rhs: Track) -> Bool {
        lhs.id == rhs.id && lhs.source == rhs.source
    }
}

struct SearchResult: Codable {
    let tracks: [Track]
    let albums: [Album]
    let artists: [Artist]
}

struct Album: Identifiable, Codable {
    let id: String
    let title: String
    let thumbnail: String
    let artist: String
    let artistId: String?
    let trackCount: Int
    let year: Int?
    let albumType: String?
}

struct Artist: Identifiable, Codable {
    let id: String
    let name: String
    let thumbnail: String
    let genres: [String]
}

struct ArtistBrief: Codable {
    let artist: Artist
    let tracks: [Track]
    let albums: [Album]
}

struct PlaylistInfo: Codable {
    let title: String
    let ownerName: String
    let coverUrl: String
    let trackCount: Int
    let tracks: [Track]
}
