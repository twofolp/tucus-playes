import AVFoundation
import Combine

final class PlayerService: ObservableObject {
    static let shared = PlayerService()

    @Published var currentTrack: Track?
    @Published var isPlaying = false
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var volume: Float = 0.8
    @Published var isMuted = false
    @Published var queue: [Track] = []
    @Published var queueIndex: Int = -1
    @Published var isShuffle = false
    @Published var isRepeat = false

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var itemObserver: Any?

    private init() {
        setupAudioSession()
    }

    private func setupAudioSession() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif
    }

    // MARK: - Playback

    func play(track: Track, in queue: [Track]? = nil, at index: Int? = nil) {
        guard let url = URL(string: track.streamUrl ?? "") else { return }

        if let queue = queue { self.queue = queue }
        if let index = index { self.queueIndex = index }
        self.currentTrack = track

        let playerItem = AVPlayerItem(url: url)
        if let existingPlayer = player {
            existingPlayer.replaceCurrentItem(with: playerItem)
        } else {
            player = AVPlayer(playerItem: playerItem)
            setupTimeObserver()
        }

        player?.volume = isMuted ? 0 : volume
        player?.play()
        isPlaying = true
    }

    func playPause() {
        guard let player = player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    func stop() {
        player?.pause()
        player?.seek(to: .zero)
        isPlaying = false
        currentTime = 0
    }

    func seek(to time: TimeInterval) {
        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        player?.seek(to: cmTime)
        currentTime = time
    }

    func next() {
        guard !queue.isEmpty else { return }
        var nextIndex: Int
        if isShuffle {
            nextIndex = Int.random(in: 0..<queue.count)
        } else {
            nextIndex = queueIndex + 1
            if nextIndex >= queue.count {
                if isRepeat {
                    nextIndex = 0
                } else {
                    stop()
                    return
                }
            }
        }
        queueIndex = nextIndex
        play(track: queue[nextIndex])
    }

    func previous() {
        guard !queue.isEmpty else { return }
        if currentTime > 3 {
            seek(to: 0)
            return
        }
        let prevIndex = max(0, queueIndex - 1)
        queueIndex = prevIndex
        play(track: queue[prevIndex])
    }

    func addToQueue(_ track: Track) {
        queue.append(track)
    }

    func removeFromQueue(at index: Int) {
        guard index >= 0 && index < queue.count else { return }
        queue.remove(at: index)
        if index < queueIndex { queueIndex -= 1 }
        else if index == queueIndex && queueIndex >= queue.count { queueIndex = queue.count - 1 }
    }

    func setVolume(_ vol: Float) {
        volume = vol
        player?.volume = isMuted ? 0 : vol
    }

    func toggleMute() {
        isMuted.toggle()
        player?.volume = isMuted ? 0 : volume
    }

    // MARK: - Helpers

    private func setupTimeObserver() {
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.currentTime = time.seconds.isFinite ? time.seconds : 0
        }

        itemObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main
        ) { [weak self] _ in
            self?.next()
        }
    }

    func loadStreamUrl(for track: Track, source: String, token: String?) async throws -> Track {
        var updated = track
        switch source {
        case "yandex":
            guard let token = token else { throw PlayerError.noToken }
            updated = Track(id: track.id, title: track.title, artist: track.artist,
                           artistId: track.artistId, artists: track.artists,
                           duration: track.duration, thumbnail: track.thumbnail,
                           source: .yandex, streamUrl: try await YandexMusicService.shared.getStreamUrl(trackId: track.id, token: token))
        case "soundcloud":
            updated = Track(id: track.id, title: track.title, artist: track.artist,
                           artistId: track.artistId, artists: track.artists,
                           duration: track.duration, thumbnail: track.thumbnail,
                           source: .soundcloud, streamUrl: try await SoundCloudService.shared.getStreamUrl(trackId: track.id))
        default:
            break
        }
        return updated
    }

    deinit {
        if let observer = timeObserver { player?.removeTimeObserver(observer) }
        if let observer = itemObserver { NotificationCenter.default.removeObserver(observer) }
    }
}

enum PlayerError: LocalizedError {
    case noToken
    case noStreamUrl

    var errorDescription: String? {
        switch self {
        case .noToken: return "Yandex Music token required"
        case .noStreamUrl: return "No stream URL available"
        }
    }
}
