import SwiftUI

struct MiniPlayerView: View {
    @EnvironmentObject var player: PlayerService
    @Binding var showNowPlaying: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Progress bar
            ProgressView(value: player.duration > 0 ? player.currentTime / player.duration : 0)
                .tint(.purple)
                .frame(height: 2)

            HStack(spacing: 12) {
                // Thumbnail
                AsyncImage(url: URL(string: player.currentTrack?.thumbnail ?? "")) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.gray.opacity(0.3))
                        .overlay(Image(systemName: "music.note").foregroundColor(.gray))
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Track info
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.currentTrack?.title ?? "")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    Text(player.currentTrack?.artist ?? "")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Controls
                HStack(spacing: 16) {
                    Button(action: { player.previous() }) {
                        Image(systemName: "backward.fill")
                            .font(.system(size: 18))
                    }

                    Button(action: { player.playPause() }) {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 24))
                    }

                    Button(action: { player.next() }) {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 18))
                    }
                }
                .foregroundColor(.primary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .onTapGesture { showNowPlaying = true }
        }
    }
}
