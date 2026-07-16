import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var player: PlayerService
    @State private var yandexToken = StorageService.shared.yandexToken
    @State private var autoFetchLyrics = StorageService.shared.autoFetchLyrics
    @State private var showTranslation = StorageService.shared.showTranslation
    @State private var tokenSaved = false

    var body: some View {
        NavigationView {
            Form {
                // Yandex Music
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Yandex Music Token")
                            .font(.headline)
                        Text("Get your OAuth token from Yandex Music web version. Open DevTools → Application → Cookies → find `Session_id` or use OAuth flow.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        SecureField("Paste token here", text: $yandexToken)
                            .textFieldStyle(.roundedBorder)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                        Button(action: saveToken) {
                            HStack {
                                Image(systemName: tokenSaved ? "checkmark.circle.fill" : "square.and.arrow.down")
                                Text(tokenSaved ? "Saved!" : "Save Token")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(tokenSaved ? .green : .purple)
                    }
                } header: {
                    Text("API Keys")
                }

                // Playback
                Section("Playback") {
                    Toggle("Auto-fetch Lyrics", isOn: $autoFetchLyrics)
                        .onChange(of: autoFetchLyrics) { _ in
                            StorageService.shared.autoFetchLyrics = autoFetchLyrics
                        }
                    Toggle("Show Translation", isOn: $showTranslation)
                        .onChange(of: showTranslation) { _ in
                            StorageService.shared.showTranslation = showTranslation
                        }
                }

                // Volume
                Section("Volume") {
                    HStack {
                        Image(systemName: player.isMuted ? "speaker.fill" : "speaker.wave.2.fill")
                        Slider(value: Binding(
                            get: { player.volume },
                            set: { player.setVolume($0) }
                        ), in: 0...1)
                    }
                }

                // Queue
                Section("Queue") {
                    HStack {
                        Button(action: { player.isShuffle.toggle() }) {
                            Image(systemName: "shuffle")
                                .foregroundColor(player.isShuffle ? .purple : .primary)
                        }
                        Spacer()
                        Button(action: { player.isRepeat.toggle() }) {
                            Image(systemName: "repeat")
                                .foregroundColor(player.isRepeat ? .purple : .primary)
                        }
                    }
                    .font(.title3)

                    if !player.queue.isEmpty {
                        NavigationLink("View Queue (\(player.queue.count) tracks)") {
                            QueueView()
                                .environmentObject(player)
                        }
                    }
                }

                // About
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Source")
                        Spacer()
                        Text("github.com/twofolp/tucus-playes")
                            .foregroundColor(.secondary)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }

    private func saveToken() {
        StorageService.shared.yandexToken = yandexToken
        tokenSaved = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { tokenSaved = false }
    }
}

struct QueueView: View {
    @EnvironmentObject var player: PlayerService

    var body: some View {
        List {
            ForEach(Array(player.queue.enumerated()), id: \.element.id) { index, track in
                HStack {
                    if index == player.queueIndex {
                        Image(systemName: "speaker.wave.2.fill")
                            .foregroundColor(.purple)
                            .frame(width: 20)
                    } else {
                        Text("\(index + 1)")
                            .foregroundColor(.secondary)
                            .frame(width: 20)
                    }

                    AsyncImage(url: URL(string: track.thumbnail)) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.gray.opacity(0.2))
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 4))

                    VStack(alignment: .leading) {
                        Text(track.title)
                            .font(.system(size: 14))
                            .lineLimit(1)
                        Text(track.artist)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    Button(action: { player.removeFromQueue(at: index) }) {
                        Image(systemName: "minus.circle")
                            .foregroundColor(.red)
                    }
                }
            }
            .onMove { from, to in
                player.queue.move(fromOffsets: from, toOffset: to)
                // Update queueIndex if needed
            }
        }
        .navigationTitle("Queue")
        .navigationBarTitleDisplayMode(.inline)
    }
}
