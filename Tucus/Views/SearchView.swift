import SwiftUI

struct SearchView: View {
    @EnvironmentObject var player: PlayerService
    @EnvironmentObject var storage: StorageViewModel
    @State private var query = ""
    @State private var isLoading = false
    @State private var tracks: [Track] = []
    @State private var selectedSource = "all"
    @State private var searchTask: Task<Void, Never>?

    let sources = ["all", "yandex", "soundcloud"]

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search music...", text: $query)
                        .textFieldStyle(.plain)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .onSubmit { performSearch() }
                    if !query.isEmpty {
                        Button(action: { query = ""; tracks = [] }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(12)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .padding(.horizontal)
                .padding(.top, 8)

                // Source picker
                Picker("Source", selection: $selectedSource) {
                    ForEach(sources, id: \.self) { src in
                        Text(src == "all" ? "All" : src.capitalized).tag(src)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)
                .onChange(of: selectedSource) { _ in performSearch() }

                // Results
                if isLoading {
                    Spacer()
                    ProgressView("Searching...")
                    Spacer()
                } else if tracks.isEmpty && !query.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        Text("No results found")
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                } else {
                    List(tracks) { track in
                        TrackRow(track: track) {
                            playTrack(track)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Search")
        }
    }

    private func performSearch() {
        searchTask?.cancel()
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        searchTask = Task {
            isLoading = true
            let token = StorageService.shared.cleanYandexToken()

            do {
                var results: [Track] = []

                if selectedSource == "all" || selectedSource == "yandex" {
                    if !token.isEmpty {
                        let yandexResults = try await YandexMusicService.shared.search(query: query, token: token)
                        results.append(contentsOf: yandexResults)
                    }
                }

                if selectedSource == "all" || selectedSource == "soundcloud" {
                    let scResults = try await SoundCloudService.shared.search(query: query)
                    results.append(contentsOf: scResults)
                }

                if !Task.isCancelled { tracks = results }
            } catch {
                print("Search error: \(error)")
            }
            isLoading = false
        }
    }

    private func playTrack(_ track: Track) {
        Task {
            do {
                let token = StorageService.shared.cleanYandexToken()
                let loaded = try await player.loadStreamUrl(for: track, source: track.source.rawValue, token: token)
                let index = tracks.firstIndex(where: { $0.id == track.id }) ?? 0
                player.play(track: loaded, in: tracks, at: index)
                storage.addToRecentlyPlayed(track)
            } catch {
                print("Play error: \(error)")
            }
        }
    }
}

struct TrackRow: View {
    let track: Track
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                AsyncImage(url: URL(string: track.thumbnail)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.gray.opacity(0.2))
                        .overlay(Image(systemName: "music.note").font(.system(size: 14)).foregroundColor(.gray))
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Text(track.artist)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                        Text("·")
                            .foregroundColor(.secondary)
                        SourceBadge(source: track.source)
                    }
                }

                Spacer()

                Text(formatDuration(track.duration))
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
        }
        .buttonStyle(.plain)
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let m = Int(duration) / 60
        let s = Int(duration) % 60
        return "\(m):\(s < 10 ? "0" : "")\(s)"
    }
}

struct SourceBadge: View {
    let source: Track.TrackSource

    var body: some View {
        Text(source.rawValue.uppercased())
            .font(.system(size: 9, weight: .bold))
            .foregroundColor(badgeColor)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(badgeColor.opacity(0.15))
            .cornerRadius(3)
    }

    private var badgeColor: Color {
        switch source {
        case .yandex: return .yellow
        case .soundcloud: return .orange
        case .youtube: return .red
        }
    }
}
