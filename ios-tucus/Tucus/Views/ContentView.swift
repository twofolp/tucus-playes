import SwiftUI

struct ContentView: View {
    @EnvironmentObject var player: PlayerService
    @EnvironmentObject var storage: StorageViewModel
    @State private var selectedTab = 0
    @State private var showNowPlaying = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                HomeView()
                    .tabItem { Label("Home", systemImage: "house.fill") }
                    .tag(0)
                SearchView()
                    .tabItem { Label("Search", systemImage: "magnifyingglass") }
                    .tag(1)
                LibraryView()
                    .tabItem { Label("Library", systemImage: "music.note.list") }
                    .tag(2)
                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                    .tag(3)
            }
            .tint(.purple)

            if player.currentTrack != nil {
                MiniPlayerView(showNowPlaying: $showNowPlaying)
            }
        }
        .sheet(isPresented: $showNowPlaying) {
            NowPlayingView()
                .environmentObject(player)
                .environmentObject(storage)
        }
    }
}
