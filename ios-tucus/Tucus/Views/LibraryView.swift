import SwiftUI

struct LibraryView: View {
    @EnvironmentObject var player: PlayerService
    @EnvironmentObject var storage: StorageViewModel
    @State private var selectedSection = 0
    @State private var newPlaylistName = ""
    @State private var showNewPlaylist = false
    @State private var selectedPlaylist: String?

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("Section", selection: $selectedSection) {
                    Text("Playlists").tag(0)
                    Text("Liked").tag(1)
                    Text("History").tag(2)
                }
                .pickerStyle(.segmented)
                .padding()
                .onChange(of: selectedSection) { _ in selectedPlaylist = nil }

                if let playlist = selectedPlaylist {
                    PlaylistDetailView(playlistName: playlist)
                } else {
                    switch selectedSection {
                    case 0: playlistsList
                    case 1: likedTracksList
                    case 2: historyList
                    default: playlistsList
                    }
                }
            }
            .navigationTitle("Library")
            .toolbar {
                if selectedSection == 0 {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: { showNewPlaylist = true }) {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
            .alert("New Playlist", isPresented: $showNewPlaylist) {
                TextField("Name", text: $newPlaylistName)
                Button("Create") {
                    if !newPlaylistName.isEmpty {
                        storage.createPlaylist(newPlaylistName)
                        newPlaylistName = ""
                    }
                }
                Button("Cancel", role: .cancel) { }
            }
        }
    }

    private var playlistsList: some View {
        List {
            ForEach(Array(storage.playlists.keys.sorted()), id: \.self) { name in
                Button(action: { selectedPlaylist = name }) {
                    HStack {
                        Image(systemName: "list.bullet")
                            .foregroundColor(.purple)
                        Text(name)
                            .foregroundColor(.primary)
                        Spacer()
                        Text("\(storage.playlists[name]?.count ?? 0)")
                            .foregroundColor(.secondary)
                        Image(systemName: "chevron.right")
                            .foregroundColor(.secondary)
                            .font(.system(size: 12))
                    }
                }
                .buttonStyle(.plain)
            }
            .onDelete { indexSet in
                for index in indexSet {
                    let name = Array(storage.playlists.keys.sorted())[index]
                    storage.deletePlaylist(name)
                }
            }
        }
        .listStyle(.plain)
    }

    private var likedTracksList: some View {
        List {
            ForEach(storage.likedTracks) { track in
                TrackRow(track: track) { playTrack(track) }
            }
        }
        .listStyle(.plain)
    }

    private var historyList: some View {
        List {
            ForEach(storage.recentlyPlayed) { track in
                TrackRow(track: track) { playTrack(track) }
            }
        }
        .listStyle(.plain)
    }

    private func playTrack(_ track: Track) {
        Task {
            do {
                let token = StorageService.shared.cleanYandexToken()
                let loaded = try await player.loadStreamUrl(for: track, source: track.source.rawValue, token: token)
                player.play(track: loaded, in: storage.likedTracks, at: 0)
                storage.addToRecentlyPlayed(track)
            } catch {
                print("Play error: \(error)")
            }
        }
    }
}

struct PlaylistDetailView: View {
    let playlistName: String
    @EnvironmentObject var player: PlayerService
    @EnvironmentObject var storage: StorageViewModel

    var body: some View {
        List {
            if let tracks = storage.playlists[playlistName] {
                ForEach(tracks) { track in
                    TrackRow(track: track) { playTrack(track) }
                }
                .onDelete { indexSet in
                    var pls = storage.playlists
                    pls[playlistName]?.remove(atOffsets: indexSet)
                    storage.playlists = pls
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle(playlistName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func playTrack(_ track: Track) {
        Task {
            do {
                let token = StorageService.shared.cleanYandexToken()
                let loaded = try await player.loadStreamUrl(for: track, source: track.source.rawValue, token: token)
                let tracks = storage.playlists[playlistName] ?? []
                let index = tracks.firstIndex(where: { $0.id == track.id }) ?? 0
                player.play(track: loaded, in: tracks, at: index)
                storage.addToRecentlyPlayed(track)
            } catch {
                print("Play error: \(error)")
            }
        }
    }
}
