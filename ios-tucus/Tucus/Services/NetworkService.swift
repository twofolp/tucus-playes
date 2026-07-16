import Foundation

final class NetworkService {
    static let shared = NetworkService()
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = [
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ]
        config.timeoutIntervalForRequest = 15
        session = URLSession(configuration: config)
    }

    func get(_ url: String, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
        guard let requestUrl = URL(string: url) else { throw NetworkError.invalidURL }
        var request = URLRequest(url: requestUrl)
        request.httpMethod = "GET"
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw NetworkError.invalidResponse }
        return (data, httpResponse)
    }

    func post(_ url: String, body: Data?, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
        guard let requestUrl = URL(string: url) else { throw NetworkError.invalidURL }
        var request = URLRequest(url: requestUrl)
        request.httpMethod = "POST"
        request.httpBody = body
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw NetworkError.invalidResponse }
        return (data, httpResponse)
    }

    func json<T: Decodable>(_ data: Data) throws -> T {
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }
}

enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int, String)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response"
        case .httpError(let code, let msg): return "HTTP \(code): \(msg)"
        case .decodingError(let e): return "Decoding error: \(e.localizedDescription)"
        }
    }
}
