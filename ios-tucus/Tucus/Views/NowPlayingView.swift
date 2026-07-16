import SwiftUI

struct NowPlayingView: View {
    @EnvironmentObject var player: PlayerService
    @EnvironmentObject var storage: StorageViewModel
    @Environment(\.dismiss) var dismiss
    @State private var lyrics: [LyricLine] = []
    @State private var isLoadingLyrics = false
    @State private var showLyrics = false
    @State private var showQueue = false
    @State private var isTranslating = false
    @State private var showTranslation = StorageService.shared.showTranslation

    var body: some View {
        ZStack {
            // Background gradient from album art
            LinearGradient(
                colors: [.purple.opacity(0.3), .black],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Drag handle
                Capsule()
                    .fill(Color.white.opacity(0.3))
                    .frame(width: 40, height: 5)
                    .padding(.top, 8)

                Spacer()

                // Album art
                AsyncImage(url: URL(string: player.currentTrack?.thumbnail ?? "")) { image in
                    image.resizable().aspectRatio(contentMode: .fit)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.gray.opacity(0.3))
                        .overlay(Image(systemName: "music.note").font(.system(size: 60)).foregroundColor(.gray))
                }
                .frame(width: 280, height: 280)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .purple.opacity(0.4), radius: 20)
                .padding(.top, 20)

                Spacer()

                // Track info
                VStack(spacing: 4) {
                    Text(player.currentTrack?.title ?? "")
                        .font(.title2.bold())
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    Text(player.currentTrack?.artist ?? "")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                .padding(.horizontal)

                // Lyrics toggle & actions
                HStack(spacing: 20) {
                    Button(action: { withAnimation { showLyrics.toggle() } }) {
                        Image(systemName: "text.alignleft")
                            .font(.system(size: 18))
                            .foregroundColor(showLyrics ? .purple : .secondary)
                    }

                    Button(action: {
                        if let track = player.currentTrack {
                            storage.toggleLike(track)
                        }
                    }) {
                        Image(systemName: storage.isLiked(player.currentTrack ?? Track(id: "", title: "", artist: "", artistId: nil, artists: nil, duration: 0, thumbnail: "", source: .yandex)) ? "heart.fill" : "heart")
                            .font(.system(size: 18))
                            .foregroundColor(storage.isLiked(player.currentTrack ?? Track(id: "", title: "", artist: "", artistId: nil, artists: nil, duration: 0, thumbnail: "", source: .yandex)) ? .red : .secondary)
                    }

                    Button(action: { withAnimation { showQueue.toggle() } }) {
                        Image(systemName: "list.bullet")
                            .font(.system(size: 18))
                            .foregroundColor(showQueue ? .purple : .secondary)
                    }

                    if showLyrics {
                        Button(action: translateLyrics) {
                            if isTranslating {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "globe")
                                    .font(.system(size: 18))
                                    .foregroundColor(showTranslation ? .purple : .secondary)
                            }
                        }
                    }
                }
                .padding(.vertical, 12)

                // Lyrics overlay
                if showLyrics && !lyrics.isEmpty {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: 8) {
                                ForEach(lyrics) { line in
                                    LyricLineView(line: line, currentTime: player.currentTime, showTranslation: showTranslation)
                                        .id(line.id)
                                }
                            }
                            .padding(.horizontal, 24)
                            .padding(.vertical, 8)
                        }
                        .frame(maxHeight: 200)
                        .onChange(of: player.currentTime) { _ in
                            scrollToCurrentLyric(proxy: proxy)
                        }
                    }
                }

                // Progress bar
                VStack(spacing: 4) {
                    Slider(
                        value: Binding(
                            get: { player.currentTime },
                            set: { player.seek(to: $0) }
                        ),
                        in: 0...(player.duration > 0 ? player.duration : 1)
                    )
                    .tint(.purple)

                    HStack {
                        Text(formatTime(player.currentTime))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(formatTime(player.duration))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal)

                // Controls
                HStack(spacing: 32) {
                    Button(action: { player.isShuffle.toggle() }) {
                        Image(systemName: "shuffle")
                            .font(.system(size: 20))
                            .foregroundColor(player.isShuffle ? .purple : .secondary)
                    }

                    Button(action: { player.previous() }) {
                        Image(systemName: "backward.fill")
                            .font(.system(size: 28))
                    }

                    Button(action: { player.playPause() }) {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 44))
                    }
                    .foregroundColor(.primary)

                    Button(action: { player.next() }) {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 28))
                    }

                    Button(action: { player.isRepeat.toggle() }) {
                        Image(systemName: "repeat")
                            .font(.system(size: 20))
                            .foregroundColor(player.isRepeat ? .purple : .secondary)
                    }
                }
                .foregroundColor(.primary)
                .padding(.vertical, 8)

                Spacer()
            }

            // Queue sheet
            if showQueue {
                QueueSheetView(isPresented: $showQueue)
                    .environmentObject(player)
                    .transition(.move(edge: .bottom))
            }
        }
        .onAppear { loadLyrics() }
        .onChange(of: player.currentTrack) { _ in loadLyrics() }
    }

    private func loadLyrics() {
        guard let track = player.currentTrack, StorageService.shared.autoFetchLyrics else { return }
        isLoadingLyrics = true
        Task {
            let token = StorageService.shared.cleanYandexToken()
            lyrics = await LyricsService.shared.fetchLyrics(track: track, yandexToken: token.isEmpty ? nil : token)
            isLoadingLyrics = false
        }
    }

    private func translateLyrics() {
        guard !lyrics.isEmpty else { return }
        isTranslating = true
        Task {
            lyrics = await LyricsService.shared.translateLyrics(lyrics)
            showTranslation = true
            StorageService.shared.showTranslation = true
            isTranslating = false
        }
    }

    private func scrollToCurrentLyric(proxy: ScrollViewProxy) {
        if let currentLine = lyrics.last(where: { ($0.time ?? 0) <= player.currentTime }) {
            withAnimation(.easeInOut(duration: 0.3)) {
                proxy.scrollTo(currentLine.id, anchor: .center)
            }
        }
    }

    private func formatTime(_ seconds: TimeInterval) -> String {
        let m = Int(seconds) / 60
        let s = Int(seconds) % 60
        return "\(m):\(s < 10 ? "0" : "")\(s)"
    }
}

struct LyricLineView: View {
    let line: LyricLine
    let currentTime: TimeInterval
    let showTranslation: Bool

    private var isActive: Bool {
        guard let time = line.time, let duration = line.duration else { return false }
        return currentTime >= time && currentTime < time + duration
    }

    private var isPast: Bool {
        guard let time = line.time else { return false }
        return currentTime >= time + (line.duration ?? 0)
    }

    var body: some View {
        VStack(spacing: 2) {
            Text(line.text)
                .font(isActive ? .title3.bold() : .body)
                .foregroundColor(isActive ? .white : (isPast ? .white.opacity(0.4) : .white.opacity(0.7)))
                .multilineTextAlignment(.center)
                .scaleEffect(isActive ? 1.05 : 1.0)
                .animation(.easeInOut(duration: 0.2), value: isActive)

            if showTranslation, let translation = line.translation, !translation.isEmpty {
                Text(translation)
                    .font(.subheadline)
                    .foregroundColor(isActive ? .purple.opacity(0.8) : .white.opacity(0.4))
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, 4)
    }
}

struct QueueSheetView: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var player: PlayerService

    var body: some View {
        VStack {
            Capsule()
                .fill(Color.white.opacity(0.3))
                .frame(width: 40, height: 5)
                .padding(.top, 8)

            Text("Queue")
                .font(.headline)
                .padding()

            List {
                ForEach(Array(player.queue.enumerated()), id: \.element.id) { index, track in
                    HStack {
                        if index == player.queueIndex {
                            Image(systemName: "speaker.wave.2.fill")
                                .foregroundColor(.purple)
                        } else {
                            Text("\(index + 1)")
                                .foregroundColor(.secondary)
                        }

                        AsyncImage(url: URL(string: track.thumbnail)) { image in
                            image.resizable()
                        } placeholder: {
                            RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(0.2))
                        }
                        .frame(width: 36, height: 36)
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                        VStack(alignment: .leading) {
                            Text(track.title).font(.system(size: 14)).lineLimit(1)
                            Text(track.artist).font(.system(size: 12)).foregroundColor(.secondary).lineLimit(1)
                        }
                    }
                }
            }
            .listStyle(.plain)

            Button("Close") { isPresented = false }
                .padding()
        }
        .background(Color(.systemBackground))
    }
}
