use serde::{Deserialize, Serialize};

use std::sync::Mutex;
use std::time::Instant;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

pub struct DiscordRpcState {
    pub client: Mutex<Option<DiscordIpcClient>>,
    pub last_attempt: Mutex<Option<Instant>>,
}

pub struct AppState {
    pub http_client: reqwest::Client,
    pub soundcloud_client_id: Mutex<Option<(String, Instant)>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YandexArtistCompact {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub artist_id: Option<String>,
    pub artists: Option<Vec<YandexArtistCompact>>,
    pub duration: u64,
    pub thumbnail: String,
    pub source: String,
    pub stream_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YandexAlbum {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub artist: String,
    pub artist_id: Option<String>,
    pub track_count: u32,
    pub year: Option<u32>,
    pub album_type: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YandexArtist {
    pub id: String,
    pub name: String,
    pub thumbnail: String,
    pub genres: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YandexSearchAllResults {
    pub tracks: Vec<Track>,
    pub albums: Vec<YandexAlbum>,
    pub artists: Vec<YandexArtist>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct YandexArtistBrief {
    pub artist: YandexArtist,
    pub tracks: Vec<Track>,
    pub albums: Vec<YandexAlbum>,
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);
    let start_idx = xml.find(&start_tag)? + start_tag.len();
    let end_offset = xml[start_idx..].find(&end_tag)?;
    let end_idx = start_idx + end_offset;
    Some(xml[start_idx..end_idx].to_string())
}

fn parse_yandex_track(t: &serde_json::Value) -> Option<Track> {
    let id = if let Some(id_num) = t["id"].as_i64() {
        id_num.to_string()
    } else {
        t["id"].as_str()?.to_string()
    };
    if id.is_empty() { return None; }
    
    let title = t["title"].as_str().unwrap_or("Unknown").to_string();
    
    let artists_list = t["artists"].as_array();
    let mut artists_vec = Vec::new();
    let artist = if let Some(artists) = artists_list {
        let names: Vec<&str> = artists.iter()
            .filter_map(|a| {
                let name = a["name"].as_str()?;
                if let Some(id_num) = a["id"].as_i64() {
                    artists_vec.push(YandexArtistCompact { id: id_num.to_string(), name: name.to_string() });
                } else if let Some(id_str) = a["id"].as_str() {
                    artists_vec.push(YandexArtistCompact { id: id_str.to_string(), name: name.to_string() });
                }
                Some(name)
            })
            .collect();
        if names.is_empty() { "Unknown Artist".to_string() } else { names.join(", ") }
    } else {
        "Unknown Artist".to_string()
    };
    
    let artist_id = artists_vec.first().map(|a| a.id.clone());
    
    let duration_ms = t["durationMs"].as_u64().unwrap_or(0);
    let duration = duration_ms / 1000;
    
    let cover_uri = t["coverUri"].as_str().unwrap_or("");
    let thumbnail = if !cover_uri.is_empty() {
        format!("https://{}", cover_uri.replace("%%", "400x400"))
    } else {
        "".to_string()
    };
    
    Some(Track {
        id,
        title,
        artist,
        artist_id,
        artists: Some(artists_vec),
        duration,
        thumbnail,
        source: "yandex".to_string(),
        stream_url: None,
    })
}

fn parse_yandex_album(t: &serde_json::Value) -> Option<YandexAlbum> {
    let id = if let Some(id_num) = t["id"].as_i64() {
        id_num.to_string()
    } else {
        t["id"].as_str()?.to_string()
    };
    if id.is_empty() { return None; }
    
    let title = t["title"].as_str().unwrap_or("Unknown Album").to_string();
    
    let cover_uri = t["coverUri"].as_str().unwrap_or("");
    let thumbnail = if !cover_uri.is_empty() {
        format!("https://{}", cover_uri.replace("%%", "400x400"))
    } else {
        "".to_string()
    };
    
    let artists_list = t["artists"].as_array();
    let artist = if let Some(artists) = artists_list {
        let names: Vec<&str> = artists.iter()
            .filter_map(|a| a["name"].as_str())
            .collect();
        if names.is_empty() { "Unknown Artist".to_string() } else { names.join(", ") }
    } else {
        "Unknown Artist".to_string()
    };
    
    let artist_id = if let Some(artists) = artists_list {
        artists.first().and_then(|a| {
            if let Some(id_num) = a["id"].as_i64() {
                Some(id_num.to_string())
            } else {
                a["id"].as_str().map(|s| s.to_string())
            }
        })
    } else {
        None
    };
    
    let track_count = t["trackCount"].as_u64().unwrap_or(0) as u32;
    let year = t["year"].as_u64();
    let album_type = t["type"].as_str().map(|s| s.to_string());
    
    Some(YandexAlbum {
        id,
        title,
        thumbnail,
        artist,
        artist_id,
        track_count,
        year: year.map(|y| y as u32),
        album_type,
    })
}

fn parse_yandex_artist(t: &serde_json::Value) -> Option<YandexArtist> {
    let id = if let Some(id_num) = t["id"].as_i64() {
        id_num.to_string()
    } else {
        t["id"].as_str()?.to_string()
    };
    if id.is_empty() { return None; }
    
    let name = t["name"].as_str().unwrap_or("Unknown Artist").to_string();
    
    let cover_uri = t["cover"]["uri"].as_str()
        .or_else(|| t["coverUri"].as_str())
        .unwrap_or("");
    let thumbnail = if !cover_uri.is_empty() {
        format!("https://{}", cover_uri.replace("%%", "400x400"))
    } else {
        "".to_string()
    };
    
    let mut genres = Vec::new();
    if let Some(arr) = t["genres"].as_array() {
        for g in arr {
            if let Some(s) = g.as_str() {
                genres.push(s.to_string());
            }
        }
    }
    
    Some(YandexArtist {
        id,
        name,
        thumbnail,
        genres,
    })
}

async fn get_yandex_uid(token: &str) -> Result<String, String> {
    let res = reqwest::Client::new().get("https://api.music.yandex.net/account/status")
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let uid = json["result"]["account"]["uid"].as_i64()
        .map(|id| id.to_string())
        .ok_or_else(|| "Failed to get Yandex UID from account status".to_string())?;
        
    Ok(uid)
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}




#[tauri::command]
async fn search_yandex(query: String, token: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    if token.is_empty() {
        return Err("Yandex Music OAuth token is required. Please set it in Settings.".to_string());
    }
    
    let url = format!(
        "https://api.music.yandex.net/search?text={}&type=track&page=0&pageSize=20",
        urlencoding::encode(&query)
    );
    
    let response = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API/2.0")
        .header("X-Yandex-Music-Client", "YandexMusicAPI/2.0")
        .header("Accept", "application/json")
        .header("Accept-Language", "ru,en")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
        
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Yandex API error {}: {}", status, &body[..body.len().min(200)]));
    }
        
    let json: serde_json::Value = response.json().await.map_err(|e| format!("JSON parse error: {}", e))?;
    
    let mut tracks = Vec::new();
    
    let results_arr = json["result"]["tracks"]["results"].as_array()
        .or_else(|| json["result"]["tracks"]["items"].as_array());
    
    if let Some(results) = results_arr {
        for t in results {
            if let Some(track) = parse_yandex_track(t) {
                tracks.push(track);
            }
        }
    }
    
    Ok(tracks)
}

#[tauri::command]
async fn get_yandex_stream(track_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    if token.is_empty() {
        return Err("Yandex Music OAuth token is required.".to_string());
    }
    
    // 1. Get download info URL
    let info_url = format!("https://api.music.yandex.net/tracks/{}/download-info", track_id);
    let info_res = state.http_client.get(&info_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API/2.0")
        .header("X-Yandex-Music-Client", "YandexMusicAPI/2.0")
        .header("Accept", "application/json")
        .header("Accept-Language", "ru,en")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let info_json: serde_json::Value = info_res.json().await.map_err(|e| e.to_string())?;
    
    // Find mp3 format
    let download_info_url = info_json["result"].as_array()
        .and_then(|arr| {
            arr.iter()
                .find(|item| item["codec"].as_str() == Some("mp3"))
                .or_else(|| arr.first())
        })
        .and_then(|item| item["downloadInfoUrl"].as_str())
        .ok_or_else(|| "Failed to get downloadInfoUrl".to_string())?;
        
    // 2. Fetch the XML from downloadInfoUrl
    let xml_res = state.http_client.get(download_info_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API/2.0")
        .header("X-Yandex-Music-Client", "YandexMusicAPI/2.0")
        .header("Accept", "application/xml, */*")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let xml_text = xml_res.text().await.map_err(|e| e.to_string())?;
    
    // 3. Parse XML
    let host = extract_xml_tag(&xml_text, "host").ok_or_else(|| "Missing host in XML".to_string())?;
    let path = extract_xml_tag(&xml_text, "path").ok_or_else(|| "Missing path in XML".to_string())?;
    let ts = extract_xml_tag(&xml_text, "ts").ok_or_else(|| "Missing ts in XML".to_string())?;
    let s = extract_xml_tag(&xml_text, "s").ok_or_else(|| "Missing s in XML".to_string())?;
    
    // 4. Compute hash and build download URL
    let secret = "XGRlBW9FXlekgbPrRHuSiA";
    let path_clean = if path.starts_with('/') { &path[1..] } else { &path };
    let hash_input = format!("{}{}{}", secret, path_clean, s); // MD5 input: secret + path_without_leading_slash + s
    let s_hash = md5::compute(hash_input);
    let s_hash_hex = format!("{:x}", s_hash);
    
    let download_url = format!("https://{}/get-mp3/{}/{}{}", host, s_hash_hex, ts, path);
    
    Ok(download_url)
}

async fn is_client_id_valid(client: &reqwest::Client, client_id: &str) -> bool {
    let url = format!(
        "https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id={}",
        client_id
    );
    match client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await {
            Ok(res) => res.status().is_success(),
            Err(_) => false,
        }
}

async fn fetch_soundcloud_client_id_cached(state: &tauri::State<'_, AppState>) -> Result<String, String> {
    // Check cache first (valid for 1 hour)
    {
        let cache = state.soundcloud_client_id.lock().map_err(|e| e.to_string())?;
        if let Some((ref id, ts)) = *cache {
            if ts.elapsed() < std::time::Duration::from_secs(3600) {
                return Ok(id.clone());
            }
        }
    }

    let client_id = fetch_soundcloud_client_id_inner(&state.http_client).await?;

    // Store in cache
    let mut cache = state.soundcloud_client_id.lock().map_err(|e| e.to_string())?;
    *cache = Some((client_id.clone(), Instant::now()));

    Ok(client_id)
}

async fn fetch_soundcloud_client_id_inner(client: &reqwest::Client) -> Result<String, String> {
    // 1. Try dynamic scraping from soundcloud.com
    if let Ok(res_page) = client.get("https://soundcloud.com")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await {
            if let Ok(home_html) = res_page.text().await {
                let re_script = regex::Regex::new(r#"src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)""#).unwrap();
                let mut script_urls = Vec::new();
                for cap in re_script.captures_iter(&home_html) {
                    script_urls.push(cap[1].to_string());
                }
                script_urls.reverse();
                
                let re_client_id = regex::Regex::new(r#"client_id:"([a-zA-Z0-9]{32})""#).unwrap();
                for url in script_urls {
                    if let Ok(res_js) = client.get(&url).send().await {
                        if let Ok(js_content) = res_js.text().await {
                            if let Some(cap) = re_client_id.captures(&js_content) {
                                let scraped_id = cap[1].to_string();
                                if is_client_id_valid(client, &scraped_id).await {
                                    return Ok(scraped_id);
                                }
                            }
                        }
                    }
                }
            }
        }

    // 2. Try known active fallbacks
    let fallbacks = [
        "a3e059563d7fd3372b49b37f00a00bcf",
        "2t9loNQH90kzJcsF6jGLssKfJaNuISww",
        "b45b1aa10f1ac2941910a7f0d10f8e28",
        "iYV5q4YwP9h2Kq8XqG9z8X4qW2x9K8Xq",
    ];
    for f in fallbacks {
        if is_client_id_valid(client, f).await {
            return Ok(f.to_string());
        }
    }

    Err("Failed to obtain a working SoundCloud client ID".to_string())
}

#[tauri::command]
async fn search_soundcloud(query: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let client_id = fetch_soundcloud_client_id_cached(&state).await?;
    let url = format!(
        "https://api-v2.soundcloud.com/search/tracks?q={}&client_id={}&limit=20",
        urlencoding::encode(&query),
        client_id
    );
    
    let response = state.http_client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !response.status().is_success() {
        return Err(format!("SoundCloud search failed with status: {}", response.status()));
    }
    
    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(collection) = json["collection"].as_array() {
        for t in collection {
            let id = t["id"].to_string();
            let title = t["title"].as_str().unwrap_or("Unknown Track").to_string();
            let artist = t["user"]["username"].as_str().unwrap_or("Unknown Artist").to_string();
            
            let duration_ms = t["duration"].as_u64().unwrap_or(0);
            let duration = duration_ms / 1000;
            
            let artwork_url = t["artwork_url"].as_str()
                .or_else(|| t["user"]["avatar_url"].as_str())
                .unwrap_or("")
                .to_string();
            let thumbnail = if !artwork_url.is_empty() {
                artwork_url.replace("-large.", "-t500x500.")
            } else {
                "".to_string()
            };
                
            tracks.push(Track {
                id,
                title,
                artist,
                artist_id: t["user"]["id"].as_u64().map(|id| id.to_string()),
                artists: None,
                duration,
                thumbnail,
                source: "soundcloud".to_string(),
                stream_url: None,
            });
        }
    }
    
    Ok(tracks)
}

#[tauri::command]
async fn search_soundcloud_charts(genre: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let client_id = fetch_soundcloud_client_id_cached(&state).await?;
    // SoundCloud charts API: top tracks by genre
    let url = format!(
        "https://api-v2.soundcloud.com/charts?kind=top&genre=soundcloud:genres:{}&client_id={}&limit=10",
        urlencoding::encode(&genre),
        client_id
    );
    
    let response = state.http_client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !response.status().is_success() {
        // Fallback: use regular search with genre name
        return search_soundcloud(genre.to_string(), state).await;
    }
    
    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(collection) = json["collection"].as_array() {
        for item in collection {
            // Charts items may have a "track" field or be the track directly
            let t = if item["track"].is_object() {
                &item["track"]
            } else if item["id"].is_number() {
                item
            } else {
                continue;
            };
            
            let id = t["id"].to_string();
            let title = t["title"].as_str().unwrap_or("Unknown Track").to_string();
            let artist = t["user"]["username"].as_str().unwrap_or("Unknown Artist").to_string();
            
            let duration_ms = t["duration"].as_u64().unwrap_or(0);
            let duration = duration_ms / 1000;
            
            // Skip long tracks (mixes, podcasts)
            if duration > 600 || duration < 30 { continue; }
            
            let artwork_url = t["artwork_url"].as_str()
                .or_else(|| t["user"]["avatar_url"].as_str())
                .unwrap_or("")
                .to_string();
            let thumbnail = if !artwork_url.is_empty() {
                artwork_url.replace("-large.", "-t500x500.")
            } else {
                "".to_string()
            };
                
            tracks.push(Track {
                id,
                title,
                artist,
                artist_id: t["user"]["id"].as_u64().map(|id| id.to_string()),
                artists: None,
                duration,
                thumbnail,
                source: "soundcloud".to_string(),
                stream_url: None,
            });
        }
    }
    
    // If charts returned nothing, fallback to regular search with "top" prefix
    if tracks.is_empty() {
        let fallback_query = format!("top {}", genre);
        return search_soundcloud(fallback_query, state).await;
    }
    
    Ok(tracks)
}

#[tauri::command]
async fn get_soundcloud_user_tracks(user_id: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let client_id = fetch_soundcloud_client_id_cached(&state).await?;
    
    // Get user info
    let user_url = format!(
        "https://api-v2.soundcloud.com/users/{}?client_id={}",
        user_id, client_id
    );
    let user_resp = state.http_client.get(&user_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send().await.map_err(|e| e.to_string())?;
    let user_json: serde_json::Value = user_resp.json().await.map_err(|e| e.to_string())?;
    let _username = user_json["username"].as_str().unwrap_or("Unknown Artist");

    // Get user's tracks
    let tracks_url = format!(
        "https://api-v2.soundcloud.com/users/{}/tracks?client_id={}&limit=20&representation=full",
        user_id, client_id
    );
    let resp = state.http_client.get(&tracks_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("SoundCloud user tracks failed: {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut tracks = Vec::new();
    if let Some(collection) = json["collection"].as_array() {
        for t in collection {
            let id = t["id"].to_string();
            let title = t["title"].as_str().unwrap_or("Unknown Track").to_string();
            let artist = t["user"]["username"].as_str().unwrap_or("Unknown Artist").to_string();
            let duration_ms = t["duration"].as_u64().unwrap_or(0);
            let duration = duration_ms / 1000;
            let artwork_url = t["artwork_url"].as_str()
                .or_else(|| t["user"]["avatar_url"].as_str())
                .unwrap_or("").to_string();
            let thumbnail = if !artwork_url.is_empty() {
                artwork_url.replace("-large.", "-t500x500.")
            } else { "".to_string() };
            tracks.push(Track {
                id, title, artist,
                artist_id: Some(user_id.clone()),
                artists: None, duration, thumbnail,
                source: "soundcloud".to_string(), stream_url: None,
            });
        }
    }
    Ok(tracks)
}

#[tauri::command]
async fn get_soundcloud_stream(track_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let client_id = fetch_soundcloud_client_id_cached(&state).await?;
    
    // 1. Get track details to find media stream auth URLs
    let url = format!(
        "https://api-v2.soundcloud.com/tracks/{}?client_id={}",
        track_id,
        client_id
    );
    
    let response = state.http_client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    let transcodings = json["media"]["transcodings"].as_array()
        .ok_or_else(|| "Missing SoundCloud transcodings".to_string())?;
        
    let best_transcoding = transcodings.iter()
        .find(|t| t["format"]["protocol"].as_str() == Some("progressive"))
        .or_else(|| {
            transcodings.iter()
                .find(|t| t["format"]["protocol"].as_str() == Some("hls"))
        })
        .ok_or_else(|| "Failed to find suitable SoundCloud media format".to_string())?;
        
    let stream_auth_url = best_transcoding["url"].as_str()
        .ok_or_else(|| "Missing stream auth URL".to_string())?;
        
    // 2. Fetch direct streaming URL
    let stream_url_req = format!("{}?client_id={}", stream_auth_url, client_id);
    let stream_res = state.http_client.get(&stream_url_req)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let stream_json: serde_json::Value = stream_res.json().await.map_err(|e| e.to_string())?;
    
    // Try multiple response formats
    let direct_url = stream_json["url"].as_str()
        .or_else(|| stream_json["location"].as_str())
        .or_else(|| {
            // Some transcodings return the URL directly as a string
            stream_json.as_str()
        })
        .ok_or_else(|| format!("Failed to parse direct stream URL. Response: {}", stream_json))?
        .to_string();
        
    Ok(direct_url)
}

#[tauri::command]
async fn get_yandex_similar(track_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    if token.is_empty() {
        return Err("Yandex Music OAuth token is required".to_string());
    }
    
    let url = format!("https://api.music.yandex.net/tracks/{}/similar", track_id);
    let res = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(similar_tracks) = json["result"]["similarTracks"].as_array() {
        for t in similar_tracks {
            if let Some(track) = parse_yandex_track(t) {
                tracks.push(track);
            }
        }
    }
    
    Ok(tracks)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Syllable {
    pub text: String,
    pub time: u64,
    pub duration: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LyricLine {
    pub time: Option<u64>,
    pub duration: Option<u64>,
    pub text: String,
    pub syllabus: Vec<Syllable>,
}

fn parse_lrc(lyrics_text: &str) -> Vec<LyricLine> {
    let line_time_re = regex::Regex::new(r"\[(\d+):(\d+)[:.](\d+)\]").unwrap();
    let plain_time_re = regex::Regex::new(r"\[(\d+):(\d+)\]").unwrap();
    // Enhanced LRC word tags: <MM:SS.cc>
    let word_tag_re = regex::Regex::new(r"<(\d+):(\d+)[:.](\d+)>").unwrap();
    
    let mut lines: Vec<LyricLine> = Vec::new();

    for raw_line in lyrics_text.lines() {
        let line = raw_line.trim();
        if line.is_empty() { continue; }
        
        // Skip metadata tags like [ti:...] [ar:...] [al:...]
        if line.starts_with('[') && !line_time_re.is_match(line) && !plain_time_re.is_match(line) {
            continue;
        }

        // Find all line-level timestamps (compressed LRC: [01:00][02:00]Text)
        let time_matches: Vec<_> = line_time_re.find_iter(line).collect();
        if time_matches.is_empty() {
            // Try plain format [MM:SS]
            if let Some(caps) = plain_time_re.captures(line) {
                let mins: u64 = caps[1].parse().unwrap_or(0);
                let secs: u64 = caps[2].parse().unwrap_or(0);
                let text = plain_time_re.replace_all(line, "").trim().to_string();
                if !text.is_empty() {
                    lines.push(LyricLine { 
                        time: Some(mins * 60_000 + secs * 1_000), 
                        duration: None,
                        text, 
                        syllabus: Vec::new() 
                    });
                }
            } else if !line.starts_with('[') {
                lines.push(LyricLine { time: None, duration: None, text: line.to_string(), syllabus: Vec::new() });
            }
            continue;
        }

        // Get content after removing line timestamps
        let content = line_time_re.replace_all(line, "").trim().to_string();
        
        // Check for Enhanced LRC word timestamps
        let word_matches: Vec<_> = word_tag_re.find_iter(&content).collect();
        let has_word_tags = !word_matches.is_empty();

        let mut syllabus: Vec<Syllable> = Vec::new();
        let mut clean_text = content.clone();

        if has_word_tags {
            // Parse word-level timestamps
            let mut last_index = 0;
            let mut current_word_time = 0u64;
            
            for wm in &word_matches {
                let wm_start = wm.start();
                let wm_end = wm.end();
                
                // Text before this tag
                let pre_text = &content[last_index..wm_start];
                if !pre_text.is_empty() {
                    syllabus.push(Syllable {
                        text: pre_text.to_string(),
                        time: current_word_time,
                        duration: 0,
                    });
                }
                
                // Parse the timestamp
                if let Some(caps) = word_tag_re.captures(wm.as_str()) {
                    let mins: u64 = caps[1].parse().unwrap_or(0);
                    let secs: u64 = caps[2].parse().unwrap_or(0);
                    let ms_str = &caps[3];
                    let ms_val: u64 = ms_str.parse().unwrap_or(0);
                    let ms = match ms_str.len() {
                        1 => ms_val * 100,
                        2 => ms_val * 10,
                        _ => ms_val,
                    };
                    current_word_time = mins * 60_000 + secs * 1_000 + ms;
                }
                
                last_index = wm_end;
            }
            
            // Tail text
            let tail = &content[last_index..];
            if !tail.is_empty() {
                syllabus.push(Syllable {
                    text: tail.to_string(),
                    time: current_word_time,
                    duration: 0,
                });
            }
            
            // Clean content (remove word tags)
            clean_text = word_tag_re.replace_all(&content, "").trim().to_string();
        }

        // For each line timestamp, create a LyricLine
        for (_i, tm) in time_matches.iter().enumerate() {
            let line_time = {
                let s = tm.as_str();
                let caps = line_time_re.captures(s).unwrap();
                let mins: u64 = caps[1].parse().unwrap_or(0);
                let secs: u64 = caps[2].parse().unwrap_or(0);
                let cs_str = &caps[3];
                let cs_val: u64 = cs_str.parse().unwrap_or(0);
                let ms = match cs_str.len() {
                    1 => cs_val * 100,
                    2 => cs_val * 10,
                    _ => cs_val,
                };
                mins * 60_000 + secs * 1_000 + ms
            };

            // Adjust first syllable time if it was 0
            let mut line_syllabus: Vec<Syllable> = syllabus.iter().map(|s| Syllable {
                text: s.text.clone(),
                time: if s.time == 0 { line_time } else { s.time },
                duration: s.duration,
            }).collect();

            // Calculate syllable durations
            for j in 0..line_syllabus.len().saturating_sub(1) {
                if line_syllabus[j + 1].time > line_syllabus[j].time {
                    line_syllabus[j].duration = line_syllabus[j + 1].time - line_syllabus[j].time;
                }
            }

            lines.push(LyricLine {
                time: Some(line_time),
                duration: None,
                text: clean_text.clone(),
                syllabus: line_syllabus,
            });
        }
    }

    // Calculate line durations based on next line time
    for i in 0..lines.len() {
        if let Some(time) = lines[i].time {
            let duration = if i + 1 < lines.len() {
                lines[i + 1].time.unwrap_or(time + 5000) - time
            } else {
                5000
            };
            lines[i].duration = Some(duration);
            
            // Fix last syllable duration
            if let Some(last_syl) = lines[i].syllabus.last_mut() {
                if last_syl.duration == 0 {
                    last_syl.duration = duration.saturating_sub(last_syl.time.saturating_sub(time));
                }
            }
        }
    }

    lines
}

fn clean_track_metadata(s: &str) -> String {
    let re_feat = regex::Regex::new(r"(?i)\b(feat|ft|prod|with)\b.*").unwrap();
    let re_extra = regex::Regex::new(r"\s*[\(\[][^)]*[\)\]]").unwrap();
    let re_symbols = regex::Regex::new(r"[^\w\s']").unwrap();

    let mut cleaned = s.to_string();
    cleaned = re_feat.replace_all(&cleaned, "").to_string();
    cleaned = re_extra.replace_all(&cleaned, "").to_string();
    cleaned = re_symbols.replace_all(&cleaned, " ").to_string();
    
    let re_spaces = regex::Regex::new(r"\s+").unwrap();
    cleaned = re_spaces.replace_all(&cleaned, " ").to_string();
    
    cleaned.trim().to_string()
}

// Exact match via LRCLIB /api/get endpoint
async fn get_lrclib_exact(
    client: &reqwest::Client,
    artist: &str,
    title: &str,
    duration: Option<u64>,
) -> Option<Vec<LyricLine>> {
    let mut url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}",
        urlencoding::encode(artist),
        urlencoding::encode(title)
    );
    if let Some(d) = duration {
        url = format!("{}&duration={}", url, d);
    }

    let res = client.get(&url)
        .header("User-Agent", "TauriMusicPlayer/1.0")
        .send().await.ok()?;
    if !res.status().is_success() { return None; }
    let json: serde_json::Value = res.json().await.ok()?;

    // Verify artist match — LRCLIB returns artistName field
    if let Some(lrclib_artist) = json["artistName"].as_str() {
        let normalised = lrclib_artist.to_lowercase().replace([' ', ','], "");
        let query_artist = artist.to_lowercase().replace([' ', ','], "");
        // Fuzzy: check if the main artist name is contained
        let main_artist = query_artist.split(';').next().unwrap_or(&query_artist);
        if !normalised.contains(main_artist) && !main_artist.contains(&normalised) {
            return None;
        }
    }

    parse_lrclib_response(&json)
}

// Search fallback via LRCLIB /api/search endpoint
async fn search_lrclib_fallback(
    client: &reqwest::Client,
    artist: &str,
    title: &str,
    duration: Option<u64>,
) -> Option<Vec<LyricLine>> {
    let query = format!("{} {}", artist, title);
    let url = format!("https://lrclib.net/api/search?q={}", urlencoding::encode(&query));
    let res = client.get(&url)
        .header("User-Agent", "TauriMusicPlayer/1.0")
        .send().await.ok()?;
    if !res.status().is_success() { return None; }
    let results: serde_json::Value = res.json().await.ok()?;
    let results_arr = results.as_array()?;
    if results_arr.is_empty() { return None; }

    // Score each result: prefer exact duration match + artist match
    let target_dur = duration.map(|d| d as i64);
    let query_artist = artist.to_lowercase().replace([' ', ','], "");
    let query_title = title.to_lowercase().replace([' ', ','], "");

    let mut best_score = -1i64;
    let mut best_item = &results_arr[0];

    for item in results_arr {
        let mut score = 0i64;

        // Artist match: +100
        if let Some(item_artist) = item["artistName"].as_str() {
            let norm = item_artist.to_lowercase().replace([' ', ','], "");
            if norm.contains(&query_artist) || query_artist.contains(&norm) {
                score += 100;
            }
        }

        // Title match: +50
        if let Some(item_title) = item["trackName"].as_str() {
            let norm = item_title.to_lowercase().replace([' ', ','], "");
            if norm.contains(&query_title) || query_title.contains(&norm) {
                score += 50;
            }
        }

        // Duration match: +200 if within 3s, +100 if within 10s
        if let (Some(target), Some(item_dur)) = (target_dur, item["duration"].as_f64()) {
            let diff = (item_dur as i64 - target).abs();
            if diff <= 3 { score += 200; }
            else if diff <= 10 { score += 100; }
        }

        // Prefer synced lyrics: +30
        if item["syncedLyrics"].as_str().map_or(false, |s| !s.is_empty()) {
            score += 30;
        }

        if score > best_score {
            best_score = score;
            best_item = item;
        }
    }

    parse_lrclib_response(best_item)
}

fn parse_lrclib_response(json: &serde_json::Value) -> Option<Vec<LyricLine>> {
    if let Some(synced) = json["syncedLyrics"].as_str() {
        if !synced.is_empty() {
            let parsed = parse_lrc(synced);
            if !parsed.is_empty() { return Some(parsed); }
        }
    }

    if let Some(plain) = json["plainLyrics"].as_str() {
        if !plain.is_empty() {
            let mut lines = Vec::new();
            for line in plain.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    lines.push(LyricLine { time: None, duration: None, text: trimmed.to_string(), syllabus: Vec::new() });
                }
            }
            if !lines.is_empty() { return Some(lines); }
        }
    }
    None
}

#[tauri::command]
async fn get_yandex_lyrics(track_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<Vec<LyricLine>, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }

    // List of URLs to try
    let urls = vec![
        format!("https://api.music.yandex.net/tracks/{}/lyrics?format=LRC&timeStamped=true", track_id),
        format!("https://api.music.yandex.net/tracks/{}/supplement", track_id),
    ];

    for url in urls {
        let res = match state.http_client.get(&url)
            .header("Authorization", format!("OAuth {}", token))
            .header("User-Agent", "Yandex-Music-API/2.0")
            .header("X-Yandex-Music-Client", "YandexMusicAPI/2.0")
            .header("Accept", "application/json")
            .send().await {
                Ok(response) => response,
                Err(_) => continue,
            };

        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                // Try downloadUrl
                let download_url = json["result"]["lyrics"]["downloadUrl"].as_str()
                    .or_else(|| json["result"]["downloadUrl"].as_str())
                    .or_else(|| json["lyrics"]["downloadUrl"].as_str());

                if let Some(d_url) = download_url {
                    let s3_client = reqwest::Client::new();
                    if let Ok(s3_res) = s3_client.get(d_url)
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
                        .send().await {
                            if s3_res.status().is_success() {
                                if let Ok(text) = s3_res.text().await {
                                    let lines = parse_lrc(&text);
                                    if !lines.is_empty() {
                                        return Ok(lines);
                                    }
                                }
                            }
                        }
                }

                // Try fullLyrics or text fields
                let full_lyrics = json["result"]["lyrics"]["fullLyrics"].as_str()
                    .or_else(|| json["result"]["fullLyrics"].as_str())
                    .or_else(|| json["result"]["lyrics"]["text"].as_str())
                    .or_else(|| json["result"]["text"].as_str())
                    .or_else(|| json["lyrics"]["fullLyrics"].as_str());

                if let Some(lyrics_text) = full_lyrics {
                    if !lyrics_text.is_empty() {
                        let lines = parse_lrc(lyrics_text);
                        if !lines.is_empty() {
                            return Ok(lines);
                        }
                        // Fallback to plain lines if parse_lrc didn't yield anything
                        let mut plain_lines = Vec::new();
                        for line in lyrics_text.lines() {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() {
                                plain_lines.push(LyricLine { time: None, duration: None, text: trimmed.to_string(), syllabus: Vec::new() });
                            }
                        }
                        if !plain_lines.is_empty() {
                            return Ok(plain_lines);
                        }
                    }
                }
            }
        }
    }

    Err("Lyrics not found on Yandex Music".to_string())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct YandexPlaylistInfo {
    pub title: String,
    pub owner_name: String,
    pub cover_url: String,
    pub track_count: u64,
    pub tracks: Vec<Track>,
}

#[tauri::command]
async fn get_yandex_playlist_info(owner: String, playlist_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<YandexPlaylistInfo, String> {
    let url = format!("https://api.music.yandex.net/users/{}/playlists/{}", owner, playlist_id);
    let mut req = state.http_client.get(&url)
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android");
        
    if !token.is_empty() {
        req = req.header("Authorization", format!("OAuth {}", token));
    }
    
    let res = req.send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let title = json["result"]["title"].as_str().unwrap_or("Playlist").to_string();
    let owner_name = json["result"]["owner"]["name"].as_str().unwrap_or("Yandex Music").to_string();
    let cover_uri = json["result"]["cover"]["uri"].as_str().unwrap_or("");
    
    let cover_url = if !cover_uri.is_empty() {
        format!("https://{}", cover_uri.replace("%%", "400x400"))
    } else {
        "".to_string()
    };
    
    let track_count = json["result"]["trackCount"].as_u64().unwrap_or(0);
    
    let mut tracks = Vec::new();
    
    // Yandex playlists return tracks in the "tracks" field, which is an array of track items
    let tracks_source = json["result"]["tracks"].as_array()
        .or_else(|| json["result"]["items"].as_array());
        
    if let Some(tracks_arr) = tracks_source {
        for item in tracks_arr {
            let track_val = &item["track"];
            if let Some(track) = parse_yandex_track(track_val) {
                tracks.push(track);
            }
        }
    }
    
    Ok(YandexPlaylistInfo {
        title,
        owner_name,
        cover_url,
        track_count,
        tracks,
    })
}

#[tauri::command]
async fn get_lyrics(
    title: String,
    artist: String,
    duration: Option<u64>,
    _platform: Option<String>,
    _track_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LyricLine>, String> {
    let clean_artist = if artist.contains(',') {
        artist.split(',').next().unwrap_or(&artist).to_string()
    } else if artist.contains('&') {
        artist.split('&').next().unwrap_or(&artist).to_string()
    } else {
        artist.clone()
    };
    let clean_artist = clean_track_metadata(&clean_artist);
    let clean_title = clean_track_metadata(&title);

    // 1. Exact match: cleaned artist + title + duration
    if let Some(lines) = get_lrclib_exact(&state.http_client, &clean_artist, &clean_title, duration).await {
        return Ok(lines);
    }

    // 2. Exact match: original artist + title + duration
    if let Some(lines) = get_lrclib_exact(&state.http_client, &artist, &title, duration).await {
        return Ok(lines);
    }

    // 3. Fallback search with scoring
    if let Some(lines) = search_lrclib_fallback(&state.http_client, &clean_artist, &clean_title, duration).await {
        return Ok(lines);
    }

    // 4. Fallback search: original
    if let Some(lines) = search_lrclib_fallback(&state.http_client, &artist, &title, duration).await {
        return Ok(lines);
    }

    Err("No lyrics found".to_string())
}


#[tauri::command]
async fn get_yandex_my_wave_tracks(token: String, station_id: Option<String>, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    if token.is_empty() {
        return Err("Yandex Music OAuth token is required".to_string());
    }
    
    let station = station_id.unwrap_or_else(|| "user:onyourwave".to_string());
    let url = format!("https://api.music.yandex.net/rotor/station/{}/tracks", station);
    let res = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(sequence) = json["result"]["sequence"].as_array() {
        for item in sequence {
            if let Some(t) = item["track"].as_object() {
                let track_val = serde_json::Value::Object(t.clone());
                if let Some(track) = parse_yandex_track(&track_val) {
                    tracks.push(track);
                }
            }
        }
    }
    
    Ok(tracks)
}

#[tauri::command]
async fn update_discord_presence(
    state: tauri::State<'_, DiscordRpcState>,
    title: String,
    artist: String,
    is_playing: bool,
    thumbnail: String,
    current_time: u64,
    duration: u64,
) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    
    if client_lock.is_none() {
        let mut last_attempt_lock = state.last_attempt.lock().map_err(|e| e.to_string())?;
        let should_attempt = match *last_attempt_lock {
            Some(last_time) => last_time.elapsed() >= std::time::Duration::from_secs(30),
            None => true,
        };

        if should_attempt {
            *last_attempt_lock = Some(std::time::Instant::now());
            let app_id = "1525988558517702758";
            match DiscordIpcClient::new(app_id) {
                Ok(mut client) => {
                    if let Err(e) = client.connect() {
                        eprintln!("[Discord RPC] Connection failed: {:?}", e);
                    } else {
                        eprintln!("[Discord RPC] Connected successfully!");
                        *client_lock = Some(client);
                    }
                }
                Err(e) => {
                    eprintln!("[Discord RPC] Client creation failed: {:?}", e);
                }
            }
        } else {
            return Err("Discord connection attempt throttled".to_string());
        }
    }
    
    let state_str_buf;
    let details_str_buf;

    if let Some(client) = client_lock.as_mut() {
        let payload = if is_playing {
            state_str_buf = format!("by {}", artist);
            details_str_buf = format!("Listening to: {}", title);
            
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
                
            let start_time = now.saturating_sub(current_time);
            let end_time = start_time + duration;
            
            let mut assets = activity::Assets::new();
            if !thumbnail.is_empty() && (thumbnail.starts_with("http://") || thumbnail.starts_with("https://")) {
                assets = assets.large_image(&thumbnail);
            } else {
                assets = assets.large_image("music_large");
            }
            assets = assets.large_text("tucus");

            activity::Activity::new()
                .state(&state_str_buf)
                .details(&details_str_buf)
                .assets(assets)
                .timestamps(activity::Timestamps::new()
                    .start(start_time as i64)
                    .end(end_time as i64)
                )
        } else {
            let mut assets = activity::Assets::new();
            if !thumbnail.is_empty() && (thumbnail.starts_with("http://") || thumbnail.starts_with("https://")) {
                assets = assets.large_image(&thumbnail);
            } else {
                assets = assets.large_image("music_large");
            }
            assets = assets.large_text("tucus");

            activity::Activity::new()
                .state("Paused")
                .details(&title)
                .assets(assets)
        };
        
        if let Err(e) = client.set_activity(payload) {
            *client_lock = None;
            return Err(format!("Discord RPC disconnected: {}", e));
        }
    } else {
        return Err("Discord is not running or RPC connection failed".to_string());
    }
    
    Ok(())
}

fn get_cache_dir(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    use tauri::Manager;
    let mut path = app_handle.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    path.push("liked_cache");
    let _ = std::fs::create_dir_all(&path);
    path
}

#[tauri::command]
async fn cache_liked_track(app_handle: tauri::AppHandle, track_id: String, source: String, stream_url: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let cache_dir = get_cache_dir(&app_handle);
    let file_path = cache_dir.join(format!("{}_{}.mp3", source, track_id));

    if file_path.exists() {
        return Ok(file_path.to_string_lossy().to_string());
    }

    let res = state.http_client.get(&stream_url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn check_cached_track(app_handle: tauri::AppHandle, track_id: String, source: String) -> Option<String> {
    let cache_dir = get_cache_dir(&app_handle);
    let file_path = cache_dir.join(format!("{}_{}.mp3", source, track_id));
    if file_path.exists() {
        Some(file_path.to_string_lossy().to_string())
    } else {
        None
    }
}

#[tauri::command]
async fn get_soundcloud_similar(track_id: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let client_id = fetch_soundcloud_client_id_cached(&state).await?;
    let url = format!(
        "https://api-v2.soundcloud.com/tracks/{}/related?client_id={}&limit=20",
        track_id,
        client_id
    );

    let response = state.http_client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("SoundCloud related tracks failed with status: {}", response.status()));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(collection) = json["collection"].as_array() {
        for t in collection {
            let id = t["id"].to_string();
            let title = t["title"].as_str().unwrap_or("Unknown Track").to_string();
            let artist = t["user"]["username"].as_str().unwrap_or("Unknown Artist").to_string();
            
            let duration_ms = t["duration"].as_u64().unwrap_or(0);
            let duration = duration_ms / 1000;
            
            let artwork_url = t["artwork_url"].as_str()
                .or_else(|| t["user"]["avatar_url"].as_str())
                .unwrap_or("")
                .to_string();
            let thumbnail = if !artwork_url.is_empty() {
                artwork_url.replace("-large.", "-t500x500.")
            } else {
                "".to_string()
            };
                
            tracks.push(Track {
                id,
                title,
                artist,
                artist_id: t["user"]["id"].as_u64().map(|id| id.to_string()),
                artists: None,
                duration,
                thumbnail,
                source: "soundcloud".to_string(),
                stream_url: None,
            });
        }
    }
    
    Ok(tracks)
}

#[tauri::command]
async fn search_yandex_all(query: String, token: String, state: tauri::State<'_, AppState>) -> Result<YandexSearchAllResults, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let url = format!(
        "https://api.music.yandex.net/search?text={}&type=all&page=0&pageSize=20",
        urlencoding::encode(&query)
    );
    let res = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut tracks = Vec::new();
    let mut albums = Vec::new();
    let mut artists = Vec::new();
    
    if let Some(tracks_arr) = json["result"]["tracks"]["results"].as_array()
        .or_else(|| json["result"]["tracks"]["items"].as_array()) {
        for t in tracks_arr {
            if let Some(track) = parse_yandex_track(t) {
                tracks.push(track);
            }
        }
    }
    
    if let Some(albums_arr) = json["result"]["albums"]["results"].as_array()
        .or_else(|| json["result"]["albums"]["items"].as_array()) {
        for alb in albums_arr {
            if let Some(album) = parse_yandex_album(alb) {
                albums.push(album);
            }
        }
    }
    
    if let Some(artists_arr) = json["result"]["artists"]["results"].as_array()
        .or_else(|| json["result"]["artists"]["items"].as_array()) {
        for art in artists_arr {
            if let Some(artist) = parse_yandex_artist(art) {
                artists.push(artist);
            }
        }
    }
    
    Ok(YandexSearchAllResults {
        tracks,
        albums,
        artists,
    })
}

#[tauri::command]
async fn get_yandex_album_tracks(album_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let url = format!("https://api.music.yandex.net/albums/{}/with-tracks", album_id);
    let res = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut tracks = Vec::new();
    
    if let Some(volumes) = json["result"]["volumes"].as_array() {
        for vol in volumes {
            if let Some(tracks_arr) = vol.as_array() {
                for t in tracks_arr {
                    if let Some(track) = parse_yandex_track(t) {
                        tracks.push(track);
                    }
                }
            }
        }
    }
    Ok(tracks)
}

#[tauri::command]
async fn get_yandex_artist_brief(artist_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<YandexArtistBrief, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let url = format!("https://api.music.yandex.net/artists/{}/brief-info", artist_id);
    let res = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let artist_val = &json["result"]["artist"];
    let artist = parse_yandex_artist(artist_val).ok_or_else(|| "Failed to parse artist info".to_string())?;
    
    let mut tracks = Vec::new();
    if let Some(tracks_arr) = json["result"]["tracks"].as_array() {
        for t in tracks_arr {
            if let Some(track) = parse_yandex_track(t) {
                tracks.push(track);
            }
        }
    }
    
    let mut albums = Vec::new();
    if let Some(albums_arr) = json["result"]["albums"].as_array() {
        for alb in albums_arr {
            if let Some(album) = parse_yandex_album(alb) {
                albums.push(album);
            }
        }
    }
    
    Ok(YandexArtistBrief {
        artist,
        tracks,
        albums,
    })
}

#[tauri::command]
async fn get_yandex_chart(token: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let url = "https://api.music.yandex.net/landing3/chart";
    let res = state.http_client.get(url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut tracks = Vec::new();
    
    if let Some(tracks_arr) = json["result"]["chart"]["tracks"].as_array() {
        for item in tracks_arr {
            let track_val = &item["track"];
            if let Some(track) = parse_yandex_track(track_val) {
                tracks.push(track);
            }
        }
    }
    Ok(tracks)
}

#[tauri::command]
async fn get_yandex_new_releases(token: String, state: tauri::State<'_, AppState>) -> Result<Vec<YandexAlbum>, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let url = "https://api.music.yandex.net/landing3/new-releases";
    let res = state.http_client.get(url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut albums = Vec::new();
    
    let releases = json["result"]["newReleases"].as_array()
        .or_else(|| json["result"]["albums"].as_array());
        
    if let Some(releases_arr) = releases {
        for alb in releases_arr {
            if let Some(album) = parse_yandex_album(alb) {
                albums.push(album);
            }
        }
    }
    Ok(albums)
}

#[tauri::command]
async fn get_yandex_liked_tracks(token: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let uid = get_yandex_uid(&token).await?;
    
    let url = format!("https://api.music.yandex.net/users/{}/playlists/3", uid);
    let res = state.http_client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut tracks = Vec::new();
    
    if let Some(tracks_arr) = json["result"]["tracks"].as_array() {
        for item in tracks_arr {
            let track_val = &item["track"];
            if let Some(track) = parse_yandex_track(track_val) {
                tracks.push(track);
            }
        }
    }
    
    Ok(tracks)
}

#[tauri::command]
async fn yandex_like_track(track_id: String, token: String, remove: bool, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let uid = get_yandex_uid(&token).await?;
    
    let action = if remove { "remove" } else { "add-multiple" };
    let url = format!("https://api.music.yandex.net/users/{}/likes/tracks/{}", uid, action);
    
    let params = [("track-ids", track_id)];
    let res = state.http_client.post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !res.status().is_success() {
        return Err(format!("Yandex like failed: {}", res.status()));
    }
    Ok(())
}

#[tauri::command]
async fn yandex_dislike_track(track_id: String, token: String, remove: bool, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    let uid = get_yandex_uid(&token).await?;
    
    let action = if remove { "remove" } else { "add-multiple" };
    let url = format!("https://api.music.yandex.net/users/{}/dislikes/tracks/{}", uid, action);
    
    let params = [("track-ids", track_id)];
    let res = state.http_client.post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !res.status().is_success() {
        return Err(format!("Yandex dislike failed: {}", res.status()));
    }
    Ok(())
}

async fn search_youtube_raw(query: &str, _client: &reqwest::Client) -> Result<Vec<Track>, String> {
    // Use yt-dlp to search YouTube Music instead of scraping youtube.com
    let exe = find_ytdlp();
    
    let mut cmd = std::process::Command::new(&exe);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = cmd
        .arg(format!("ytsearch10:{}", query))
        .arg("--flat-playlist")
        .arg("--dump-json")
        .arg("--no-warnings")
        .arg("--no-check-certificate")
        .output();

    match output {
        Ok(out) => {
            if !out.status.success() {
                let stderr = String::from_utf8_lossy(&out.stderr);
                return Err(format!("yt-dlp search failed: {}", stderr.trim()));
            }
            
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut tracks = Vec::new();
            
            for line in stdout.lines() {
                if line.trim().is_empty() { continue; }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                    let id = json["id"].as_str().unwrap_or("").to_string();
                    if id.is_empty() { continue; }
                    
                    let title = json["title"].as_str().unwrap_or("Unknown").to_string();
                    let artist = json["uploader"].as_str()
                        .or_else(|| json["channel"].as_str())
                        .unwrap_or("Unknown Artist").to_string();
                    
                    let duration = json["duration"].as_f64().unwrap_or(0.0) as u64;
                    
                    let thumbnail = json["thumbnail"].as_str()
                        .or_else(|| json["thumbnails"][0]["url"].as_str())
                        .unwrap_or("")
                        .to_string();
                    
                    tracks.push(Track {
                        id,
                        title,
                        artist,
                        artist_id: None,
                        artists: None,
                        duration,
                        thumbnail,
                        source: "youtube".to_string(),
                        stream_url: None,
                    });
                }
            }
            
            Ok(tracks)
        }
        Err(e) => Err(format!("Failed to run yt-dlp: {}", e)),
    }
}

fn find_ytdlp() -> std::path::PathBuf {
    let sidecar_name = if cfg!(target_os = "windows") {
        "yt-dlp-x86_64-pc-windows-msvc.exe"
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") { "yt-dlp-aarch64-apple-darwin" }
        else { "yt-dlp-x86_64-apple-darwin" }
    } else {
        "yt-dlp-x86_64-unknown-linux-gnu"
    };
    let local_name = if cfg!(target_os = "windows") { "yt-dlp.exe" } else { "yt-dlp" };

    let paths_to_check = vec![
        std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join(sidecar_name))),
        std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join(local_name))),
        Some(std::path::PathBuf::from(local_name)),
    ];

    for path in paths_to_check {
        if let Some(p) = path {
            if p.exists() { return p; }
        }
    }
    std::path::PathBuf::from(local_name)
}

#[tauri::command]
async fn search_youtube(query: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    search_youtube_raw(&query, &state.http_client).await
}

#[tauri::command]
async fn get_youtube_stream(video_id: String) -> Result<String, String> {
    let video_url = format!("https://www.youtube.com/watch?v={}", video_id);
    let exe = find_ytdlp();

    let mut cmd = std::process::Command::new(&exe);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
        .arg("-g")
        .arg("-f")
        .arg("bestaudio")
        .arg("--no-check-certificate")
        .arg(&video_url)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let trimmed = stdout.trim().to_string();
                if trimmed.starts_with("http") {
                    Ok(trimmed)
                } else {
                    Err(format!("Invalid stream URL returned: {}", trimmed))
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                Err(format!("yt-dlp failed: {}", stderr.trim()))
            }
        }
        Err(e) => Err(format!("Failed to run yt-dlp subprocess: {}", e)),
    }
}

#[tauri::command]
async fn yandex_send_feedback(station_id: String, track_id: String, feedback_type: String, timestamp: String, token: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if token.is_empty() { return Err("Yandex token required".to_string()); }
    
    let url = format!("https://api.music.yandex.net/rotor/station/{}/feedback", station_id);
    
    let payload = serde_json::json!({
        "type": feedback_type,
        "trackId": track_id,
        "timestamp": timestamp,
    });
    
    let res = state.http_client.post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android")
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !res.status().is_success() {
        return Err(format!("Yandex feedback failed: {}", res.status()));
    }
    Ok(())
}

#[tauri::command]
async fn start_yandex_oauth(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let url = "https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d";
    
    let app_handle_clone = app_handle.clone();
    
    // Close existing oauth window if open
    if let Some(w) = app_handle.get_webview_window("yandex_oauth") {
        let _ = w.close();
    }
    
    let _oauth_window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "yandex_oauth",
        tauri::WebviewUrl::External(url.parse().unwrap()),
    )
    .title("Yandex Music Login")
    .inner_size(600.0, 700.0)
    .center()
    .resizable(true)
    .on_navigation(move |nav_url| {
        use tauri::Emitter;
        let url_str = nav_url.as_str();
        if url_str.contains("access_token=") {
            // Extract token!
            let parts: Vec<&str> = url_str.split("access_token=").collect();
            if parts.len() > 1 {
                let after_token = parts[1];
                let token_parts: Vec<&str> = after_token.split('&').collect();
                let token = token_parts[0].to_string();
                let _ = app_handle_clone.emit("yandex_token_captured", token);
                
                // Close the window asynchronously to prevent deadlocks
                let ah = app_handle_clone.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(w) = ah.get_webview_window("yandex_oauth") {
                        let _ = w.close();
                    }
                });
            }
        }
        true
    })
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");

    tauri::Builder::default()
        .manage(DiscordRpcState {
            client: Mutex::new(None),
            last_attempt: Mutex::new(None),
        })
        .manage(AppState {
            http_client,
            soundcloud_client_id: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            search_yandex,
            get_yandex_stream,
            search_soundcloud,
            search_soundcloud_charts,
            get_soundcloud_stream,
            get_soundcloud_user_tracks,
            get_yandex_similar,
            get_yandex_lyrics,
            get_yandex_my_wave_tracks,
            update_discord_presence,
            get_lyrics,
            search_yandex_all,
            get_yandex_album_tracks,
            get_yandex_artist_brief,
            get_yandex_chart,
            get_yandex_new_releases,
            get_yandex_liked_tracks,
            yandex_like_track,
            yandex_dislike_track,
            yandex_send_feedback,
            start_yandex_oauth,
            cache_liked_track,
            check_cached_track,
            get_soundcloud_similar,
            get_yandex_playlist_info,
            search_youtube,
            get_youtube_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
