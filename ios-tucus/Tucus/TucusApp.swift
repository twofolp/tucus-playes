import SwiftUI

@main
struct TucusApp: App {
    @StateObject private var player = PlayerService.shared
    @StateObject private var storage = StorageViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(player)
                .environmentObject(storage)
                .preferredColorScheme(.dark)
        }
    }
}

final class StorageViewModel: ObservableObject {
    let storage = StorageService.shared
    @Published var likedTracks: [Track] { didSet { storage.likedTracks = likedTracks } }
    @Published var dislikedTracks: [Track] { didSet { storage.dislikedTracks = dislikedTracks } }
    @Published var playlists: [String: [Track]] { didSet { storage.playlists = playlists } }
    @Published var recentlyPlayed: [Track] { didSet { storage.recentlyPlayed = recentlyPlayed } }

    init() {
        let s = StorageService.shared
        likedTracks = s.likedTracks
        dislikedTracks = s.dislikedTracks
        playlists = s.playlists
        recentlyPlayed = s.recentlyPlayed
    }

    func isLiked(_ track: Track) -> Bool {
        likedTracks.contains { $0.id == track.id && $0.source == track.source }
    }

    func isDisliked(_ track: Track) -> Bool {
        dislikedTracks.contains { $0.id == track.id && $0.source == track.source }
    }

    @discardableResult
    func toggleLike(_ track: Track) -> Bool {
        let isNowLiked = storage.toggleLike(track)
        likedTracks = storage.likedTracks
        dislikedTracks = storage.dislikedTracks
        return isNowLiked
    }

    @discardableResult
    func toggleDislike(_ track: Track) -> Bool {
        let isNowDisliked = storage.toggleDislike(track)
        likedTracks = storage.likedTracks
        dislikedTracks = storage.dislikedTracks
        return isNowDisliked
    }

    func addToPlaylist(_ name: String, track: Track) {
        storage.addToPlaylist(name, track: track)
        playlists = storage.playlists
    }

    func createPlaylist(_ name: String) {
        storage.createPlaylist(name)
        playlists = storage.playlists
    }

    func deletePlaylist(_ name: String) {
        storage.deletePlaylist(name)
        playlists = storage.playlists
    }

    func addToRecentlyPlayed(_ track: Track) {
        storage.addToRecentlyPlayed(track)
        recentlyPlayed = storage.recentlyPlayed
    }
}
