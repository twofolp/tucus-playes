import SwiftUI

struct HomeView: View {
    @EnvironmentObject var player: PlayerService
    @EnvironmentObject var storage: StorageViewModel
    @State private var isLoading = false
    @State private var chartTracks: [Track] = []
    @State private var soundcloudTracks: [Track] = []
    @State private var recentlyPlayed: [Track] = []

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Recently Played
                    if !storage.recentlyPlayed.isEmpty {
                        SectionHeader(title: "Recently Played", icon: "clock.fill")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(storage.recentlyPlayed.prefix(10)) { track in
                                    TrackCard(track: track) { playTrack(track) }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Liked Tracks
                    if !storage.likedTracks.isEmpty {
                        SectionHeader(title: "Liked Tracks", icon: "heart.fill")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(storage.likedTracks.prefix(10)) { track in
                                    TrackCard(track: track) { playTrack(track) }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Yandex Charts
                    if !chartTracks.isEmpty {
                        SectionHeader(title: "Charts", icon: "chart.line.uptrend.xyaxis")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(chartTracks.prefix(10)) { track in
                                    TrackCard(track: track) { playTrack(track) }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // SoundCloud
                    if !soundcloudTracks.isEmpty {
                        SectionHeader(title: "SoundCloud Picks", icon: "waveform")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(soundcloudTracks.prefix(10)) { track in
                                    TrackCard(track: track) { playTrack(track) }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Curated Playlists
                    SectionHeader(title: "Yandex Playlists", icon: "list.bullet")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(yandexPlaylists, id: \.title) { pl in
                                CuratedPlaylistCard(playlist: pl)
                            }
                        }
                        .padding(.horizontal)
                    }

                    // SoundCloud Genres
                    SectionHeader(title: "Genres", icon: "music.mic")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(soundcloudGenres, id: \.title) { genre in
                                GenreCard(genre: genre)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Tucus")
            .task { await loadHomeData() }
        }
    }

    private func playTrack(_ track: Track) {
        Task {
            do {
                let token = StorageService.shared.cleanYandexToken()
                let loaded = try await player.loadStreamUrl(for: track, source: track.source.rawValue, token: token)
                let tracks = [loaded]
                player.play(track: loaded, in: tracks, at: 0)
                storage.addToRecentlyPlayed(track)
            } catch {
                print("Play error: \(error)")
            }
        }
    }

    private func loadHomeData() async {
        isLoading = true
        let token = StorageService.shared.cleanYandexToken()

        // Load charts
        if !token.isEmpty {
            if let tracks = try? await YandexMusicService.shared.search(query: "хиты", token: token) {
                chartTracks = tracks
            }
            if let waveTracks = try? await YandexMusicService.shared.getMyWave(token: token) {
                if chartTracks.isEmpty { chartTracks = waveTracks }
            }
        }

        // Load SoundCloud
        if let tracks = try? await SoundCloudService.shared.search(query: "lofi hip hop") {
            soundcloudTracks = tracks
        }

        recentlyPlayed = storage.recentlyPlayed
        isLoading = false
    }

    private let yandexPlaylists = [
        (title: "100 хитов русского рэпа", owner: "yandexmusic", id: "1073"),
        (title: "Громкие новинки: рэп", owner: "yandexmusic", id: "2316"),
        (title: "Вечные хиты", owner: "yandexmusic", id: "2320"),
        (title: "Легенды хип-хопа", owner: "yandexmusic", id: "2228"),
    ]

    private let soundcloudGenres = [
        (title: "Lofi Beats", query: "lofi hip hop"),
        (title: "Synthwave", query: "synthwave"),
        (title: "Chill & Deep", query: "chill house"),
        (title: "Hip-Hop", query: "underground rap"),
        (title: "Techno", query: "techno set"),
    ]
}

struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.purple)
            Text(title)
                .font(.headline)
        }
        .padding(.horizontal)
    }
}

struct TrackCard: View {
    let track: Track
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                AsyncImage(url: URL(string: track.thumbnail)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.gray.opacity(0.2))
                        .overlay(Image(systemName: "music.note").foregroundColor(.gray))
                }
                .frame(width: 140, height: 140)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Text(track.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .frame(width: 140, alignment: .leading)

                Text(track.artist)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .frame(width: 140, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }
}

struct CuratedPlaylistCard: View {
    let playlist: (title: String, owner: String, id: String)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            RoundedRectangle(cornerRadius: 12)
                .fill(
                    LinearGradient(colors: [.purple.opacity(0.6), .blue.opacity(0.4)], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .frame(width: 140, height: 140)
                .overlay(
                    VStack {
                        Image(systemName: "list.bullet")
                            .font(.system(size: 32))
                            .foregroundColor(.white)
                        Text(playlist.title)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .padding(.horizontal, 8)
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Text(playlist.title)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.primary)
                .lineLimit(2)
                .frame(width: 140, alignment: .leading)
        }
    }
}

struct GenreCard: View {
    let genre: (title: String, query: String)

    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(
                    LinearGradient(colors: [.orange.opacity(0.6), .red.opacity(0.4)], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .frame(width: 120, height: 80)
                .overlay(
                    Text(genre.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}
