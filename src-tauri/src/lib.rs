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
    pub stream_cache: Mutex<std::collections::HashMap<String, (String, Instant)>>,
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
    pub explanation: Option<String>,
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
    pub monthly_listeners: Option<u64>,
    pub likes_count: Option<u64>,
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
            explanation: None,
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

fn parse_yandex_artist(json: &serde_json::Value) -> Option<YandexArtist> {
    let a = if json["result"]["artist"].is_object() {
        &json["result"]["artist"]
    } else if json["artist"].is_object() {
        &json["artist"]
    } else if json["name"].is_string() {
        json
    } else {
        return None;
    };

    let id = if let Some(id_str) = a["id"].as_str() {
        id_str.to_string()
    } else if let Some(id_num) = a["id"].as_i64() {
        id_num.to_string()
    } else if let Some(id_u) = a["id"].as_u64() {
        id_u.to_string()
    } else {
        return None;
    };

    let name = a["name"].as_str()?.to_string();

    let thumbnail = a["cover"]["uri"].as_str()
        .or_else(|| a["ogImage"].as_str())
        .map(|uri| format!("https://{}", uri.replace("%%", "400x400")))
        .unwrap_or_default();

    let genres = a["genres"].as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let monthly_listeners = a["monthlyListeners"].as_u64()
        .or_else(|| a["counts"]["monthlyListeners"].as_u64())
        .or_else(|| a["lastMonthListeners"].as_u64())
        .or_else(|| json["result"]["stats"]["lastMonthListeners"].as_u64());

    let likes_count = a["likesCount"].as_u64()
        .or_else(|| a["counts"]["likes"].as_u64());

    Some(YandexArtist {
        id,
        name,
        thumbnail,
        genres,
        monthly_listeners,
        likes_count,
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
    
    let clean_id = track_id.split(':').next().unwrap_or(&track_id);
    let cache_key = format!("yandex:{}", clean_id);
    if let Ok(guard) = state.stream_cache.lock() {
        if let Some((url, time)) = guard.get(&cache_key) {
            if time.elapsed() < std::time::Duration::from_secs(600) {
                return Ok(url.clone());
            }
        }
    }

    let info_url = format!("https://api.music.yandex.net/tracks/{}/download-info", clean_id);
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
    if let Ok(mut guard) = state.stream_cache.lock() {
        guard.insert(cache_key, (download_url.clone(), Instant::now()));
    }
    
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
            explanation: None,
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
            explanation: None,
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
            explanation: None,
            });
        }
    }
    Ok(tracks)
}

#[tauri::command]
async fn get_soundcloud_stream(track_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let cache_key = format!("soundcloud:{}", track_id);
    if let Ok(guard) = state.stream_cache.lock() {
        if let Some((url, time)) = guard.get(&cache_key) {
            if time.elapsed() < std::time::Duration::from_secs(600) {
                return Ok(url.clone());
            }
        }
    }

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

    // If the stream URL is an HLS m3u8 playlist, parse the first playable audio segment URL
    if direct_url.contains(".m3u8") || direct_url.contains("/hls") {
        if let Ok(m3u8_res) = state.http_client.get(&direct_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
            .send().await {
                if let Ok(text) = m3u8_res.text().await {
                    for line in text.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                            return Ok(trimmed.to_string());
                        }
                    }
                }
            }
    }
        
    if let Ok(mut guard) = state.stream_cache.lock() {
        guard.insert(cache_key, (direct_url.clone(), Instant::now()));
    }
        
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
                if let Some(mut track) = parse_yandex_track(&track_val) {
                    let expl = item["explanation"]["title"].as_str()
                        .or_else(|| item["explanation"]["target"]["title"].as_str())
                        .or_else(|| item["explanation"]["text"].as_str())
                        .or_else(|| item["reason"].as_str());
                    if let Some(reason) = expl {
                        track.explanation = Some(reason.to_string());
                    }
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
    _duration: u64,
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
            
            let mut assets = activity::Assets::new();
            if !thumbnail.is_empty() && (thumbnail.starts_with("http://") || thumbnail.starts_with("https://")) {
                assets = assets.large_image(&thumbnail);
            } else {
                assets = assets.large_image("music_large");
            }
            assets = assets.large_text("tucus");
            assets = assets.small_image("tucus_logo").small_text("Слушает музыку в tucus");

            activity::Activity::new()
                .state(&state_str_buf)
                .details(&details_str_buf)
                .assets(assets)
                .timestamps(activity::Timestamps::new()
                    .start(start_time as i64)
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
                .state("Пауза")
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
    let clean_id = track_id.split(':').next().unwrap_or(&track_id);
    let file_path = cache_dir.join(format!("{}_{}.mp3", source, clean_id));

    if file_path.exists() {
        if let Ok(meta) = std::fs::metadata(&file_path) {
            if meta.len() > 50000 {
                return Ok(file_path.to_string_lossy().to_string());
            } else {
                let _ = std::fs::remove_file(&file_path);
            }
        }
    }

    let res = state.http_client.get(&stream_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 50000 {
        std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
        Ok(file_path.to_string_lossy().to_string())
    } else {
        Err("Downloaded audio file is too small or invalid".to_string())
    }
}

#[tauri::command]
fn check_cached_track(app_handle: tauri::AppHandle, track_id: String, source: String) -> Option<String> {
    let cache_dir = get_cache_dir(&app_handle);
    let clean_id = track_id.split(':').next().unwrap_or(&track_id);
    let file_path = cache_dir.join(format!("{}_{}.mp3", source, clean_id));
    if file_path.exists() {
        if let Ok(meta) = std::fs::metadata(&file_path) {
            if meta.len() > 50000 {
                return Some(file_path.to_string_lossy().to_string());
            } else {
                let _ = std::fs::remove_file(&file_path);
            }
        }
    }
    None
}

#[tauri::command]
fn delete_cached_track(app_handle: tauri::AppHandle, track_id: String, source: String) {
    let cache_dir = get_cache_dir(&app_handle);
    let clean_id = track_id.split(':').next().unwrap_or(&track_id);
    let file_path = cache_dir.join(format!("{}_{}.mp3", source, clean_id));
    if file_path.exists() {
        let _ = std::fs::remove_file(&file_path);
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
            explanation: None,
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
    let mut real_id = artist_id.clone();

    if !artist_id.chars().all(|c| c.is_ascii_digit()) {
        let search_url = format!("https://api.music.yandex.net/search?text={}&type=artist&page=0", urlencoding::encode(&artist_id));
        let mut req = state.http_client.get(&search_url)
            .header("User-Agent", "Yandex-Music-API")
            .header("X-Yandex-Music-Client", "YandexMusic/Android");
        if !token.is_empty() {
            req = req.header("Authorization", format!("OAuth {}", token));
        }
        if let Ok(res) = req.send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(artists) = json["result"]["artists"]["results"].as_array() {
                    if let Some(first) = artists.first() {
                        if let Some(id_val) = first["id"].as_i64().map(|n| n.to_string()).or_else(|| first["id"].as_str().map(|s| s.to_string())) {
                            real_id = id_val;
                        }
                    }
                }
            }
        }
    }

    let url = format!("https://api.music.yandex.net/artists/{}/brief-info", real_id);
    let mut req = state.http_client.get(&url)
        .header("User-Agent", "Yandex-Music-API")
        .header("X-Yandex-Music-Client", "YandexMusic/Android");

    if !token.is_empty() {
        req = req.header("Authorization", format!("OAuth {}", token));
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let artist_val = if json["result"]["artist"].is_object() {
        &json["result"]["artist"]
    } else if json["result"].is_object() {
        &json["result"]
    } else {
        &json["artist"]
    };

    let mut artist = parse_yandex_artist(artist_val).ok_or_else(|| "Failed to parse artist info".to_string())?;
    
    if artist.monthly_listeners.is_none() || artist.monthly_listeners == Some(0) {
        if let Some(m) = json["result"]["stats"]["lastMonthListeners"].as_u64()
            .or_else(|| json["stats"]["lastMonthListeners"].as_u64())
            .or_else(|| json["result"]["artist"]["stats"]["lastMonthListeners"].as_u64())
            .or_else(|| json["result"]["artist"]["counts"]["monthlyListeners"].as_u64()) {
            artist.monthly_listeners = Some(m);
        }
    }

    let mut tracks = Vec::new();
    let tracks_arr_json = json["result"]["popularTracks"].as_array()
        .or_else(|| json["result"]["popular_tracks"].as_array())
        .or_else(|| json["result"]["tracks"].as_array());

    if let Some(tracks_arr) = tracks_arr_json {
        for item in tracks_arr {
            let t_val = if item["track"].is_object() { &item["track"] } else { item };
            if let Some(track) = parse_yandex_track(t_val) {
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
            let track_val = if item["track"].is_object() { &item["track"] } else { item };
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
async fn search_youtube(query: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    search_youtube_raw(&query, &state.http_client).await
}

#[tauri::command]
async fn get_youtube_stream(video_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let cache_key = format!("youtube:{}", video_id);
    if let Ok(guard) = state.stream_cache.lock() {
        if let Some((url, time)) = guard.get(&cache_key) {
            if time.elapsed() < std::time::Duration::from_secs(600) {
                return Ok(url.clone());
            }
        }
    }

    // 1. Try YouTube InnerTube API (No yt-dlp required!)
    let url = "https://www.youtube.com/youtubei/v1/player";
    let body = serde_json::json!({
        "videoId": video_id,
        "context": {
            "client": {
                "clientName": "ANDROID",
                "clientVersion": "19.05.36",
                "androidSdkVersion": 30,
                "hl": "en",
                "gl": "US"
            }
        }
    });

    if let Ok(res) = state.http_client.post(url)
        .header("User-Agent", "com.google.android.youtube/19.05.36 (Linux; U; Android 11; en_US)")
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(formats) = json["streamingData"]["adaptiveFormats"].as_array() {
                for fmt in formats {
                    let mime = fmt["mimeType"].as_str().unwrap_or("");
                    if mime.contains("audio") {
                        if let Some(stream_url) = fmt["url"].as_str() {
                            let stream = stream_url.to_string();
                            if let Ok(mut guard) = state.stream_cache.lock() {
                                guard.insert(cache_key.clone(), (stream.clone(), Instant::now()));
                            }
                            return Ok(stream);
                        }
                    }
                }
            }
            if let Some(formats) = json["streamingData"]["formats"].as_array() {
                for fmt in formats {
                    if let Some(stream_url) = fmt["url"].as_str() {
                        let stream = stream_url.to_string();
                        if let Ok(mut guard) = state.stream_cache.lock() {
                            guard.insert(cache_key.clone(), (stream.clone(), Instant::now()));
                        }
                        return Ok(stream);
                    }
                }
            }
        }
    }

    // 2. Fallback: Piped Public API
    let piped_instances = [
        "https://pipedapi.kavin.rocks",
        "https://api.piped.video",
        "https://pipedapi.mha.fi"
    ];

    for inst in piped_instances {
        let piped_url = format!("{}/streams/{}", inst, video_id);
        if let Ok(res) = state.http_client.get(&piped_url).timeout(std::time::Duration::from_secs(4)).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(audio_streams) = json["audioStreams"].as_array() {
                    if let Some(best) = audio_streams.first() {
                        if let Some(stream_url) = best["url"].as_str() {
                            let stream = stream_url.to_string();
                            if let Ok(mut guard) = state.stream_cache.lock() {
                                guard.insert(cache_key.clone(), (stream.clone(), Instant::now()));
                            }
                            return Ok(stream);
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback: yt-dlp binary if available
    let video_url = format!("https://www.youtube.com/watch?v={}", video_id);
    let exe = find_ytdlp();
    let mut cmd = std::process::Command::new(&exe);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    if let Ok(out) = cmd.arg("-g").arg("-f").arg("ba/bestaudio").arg("--no-playlist").arg("--no-warnings").arg(&video_url).output() {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let first_line = stdout.trim().lines().next().unwrap_or("").to_string();
            if first_line.starts_with("http") {
                if let Ok(mut guard) = state.stream_cache.lock() {
                    guard.insert(cache_key, (first_line.clone(), Instant::now()));
                }
                return Ok(first_line);
            }
        }
    }

    Err("Could not resolve YouTube stream URL".to_string())
}



async fn search_youtube_raw(query: &str, _client: &reqwest::Client) -> Result<Vec<Track>, String> {
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
                        explanation: None,
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
async fn start_vk_oauth(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let url = "https://oauth.vk.com/authorize?client_id=6463690&scope=audio,offline&redirect_uri=https://oauth.vk.com/blank.html&response_type=token&v=5.131";
    let app_handle_clone = app_handle.clone();
    if let Some(w) = app_handle.get_webview_window("vk_oauth") {
        let _ = w.close();
    }
    let js_script = r#"
        (function() {
            function updateTitle() {
                var elements = document.querySelectorAll('h1, h2, h3, h4, div, span, b, p');
                elements.forEach(function(el) {
                    if (el.children.length === 0 && el.textContent && el.textContent.indexOf('vk.com') !== -1) {
                        el.textContent = el.textContent.replace('vk.com', 'Маруся');
                    }
                });
            }
            setInterval(updateTitle, 150);
            window.addEventListener('DOMContentLoaded', updateTitle);
        })();
    "#;

    let _oauth_window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "vk_oauth",
        tauri::WebviewUrl::External(url.parse().unwrap()),
    )
    .title("Вход в «Маруся»")
    .inner_size(520.0, 680.0)
    .initialization_script(js_script)
    .center()
    .resizable(true)
    .on_navigation(move |nav_url| {
        use tauri::Emitter;
        let url_str = nav_url.as_str();
        if url_str.contains("access_token=") {
            let parts: Vec<&str> = url_str.split("access_token=").collect();
            if parts.len() > 1 {
                let after_token = parts[1];
                let token_parts: Vec<&str> = after_token.split('&').collect();
                let token = token_parts[0].to_string();
                let _ = app_handle_clone.emit("vk_token_captured", token);
                let ah = app_handle_clone.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(w) = ah.get_webview_window("vk_oauth") {
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

#[tauri::command]
async fn start_yandex_oauth(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let url = "https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d";
    let app_handle_clone = app_handle.clone();
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
            let parts: Vec<&str> = url_str.split("access_token=").collect();
            if parts.len() > 1 {
                let after_token = parts[1];
                let token_parts: Vec<&str> = after_token.split('&').collect();
                let token = token_parts[0].to_string();
                let _ = app_handle_clone.emit("yandex_token_captured", token);
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
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PlatformArtistStats {
    pub soundcloud_followers: Option<u64>,
    pub spotify_followers: Option<u64>,
}

async fn fetch_spotify_artist_followers(artist_name: &str, client: &reqwest::Client) -> Option<u64> {
    let clean_name = artist_name.trim().to_lowercase();
    if clean_name.is_empty() { return None; }

    if let Ok(token_res) = client.get("https://open.spotify.com/get_access_token?reason=transport&productType=web_player")
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .header("Cookie", "sp_t=1;")
        .send().await {
        if let Ok(token_json) = token_res.json::<serde_json::Value>().await {
            if let Some(token) = token_json["accessToken"].as_str() {
                let search_url = format!("https://api.spotify.com/v1/search?q={}&type=artist&limit=5", urlencoding::encode(artist_name));
                if let Ok(res) = client.get(&search_url)
                    .header("Authorization", format!("Bearer {}", token))
                    .header("User-Agent", "Mozilla/5.0")
                    .send().await {
                    if let Ok(json) = res.json::<serde_json::Value>().await {
                        if let Some(items) = json["artists"]["items"].as_array() {
                            for item in items {
                                let name = item["name"].as_str().unwrap_or("").trim().to_lowercase();
                                if name == clean_name || name.contains(&clean_name) || clean_name.contains(&name) {
                                    if let Some(total) = item["followers"]["total"].as_u64() {
                                        return Some(total);
                                    }
                                }
                            }
                            if let Some(first) = items.first() {
                                if let Some(total) = first["followers"]["total"].as_u64() {
                                    return Some(total);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let lastfm_url = format!(
        "https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={}&api_key=b25b959554ed76058ac220b7b2e0a026&format=json",
        urlencoding::encode(artist_name)
    );
    if let Ok(res) = client.get(&lastfm_url)
        .header("User-Agent", "Mozilla/5.0")
        .send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(listeners_str) = json["artist"]["stats"]["listeners"].as_str() {
                if let Ok(num) = listeners_str.parse::<u64>() {
                    return Some(num);
                }
            }
        }
    }

    None
}

#[tauri::command]
async fn get_artist_platform_stats(artist_name: String, state: tauri::State<'_, AppState>) -> Result<PlatformArtistStats, String> {
    let mut stats = PlatformArtistStats {
        soundcloud_followers: None,
        spotify_followers: None,
    };
    
    let clean_name = artist_name.trim().to_lowercase();
    let is_numeric = clean_name.chars().all(|c| c.is_ascii_digit() || c == '_' || c == '-');
    if is_numeric || clean_name.len() < 2 || clean_name == "unknown" || clean_name == "неизвестный исполнитель" || clean_name == "исполнитель vk" {
        return Ok(stats);
    }

    if let Ok(client_id) = fetch_soundcloud_client_id_cached(&state).await {
        let url = format!(
            "https://api-v2.soundcloud.com/search/users?q={}&client_id={}&limit=5",
            urlencoding::encode(&artist_name),
            client_id
        );
        if let Ok(res) = state.http_client.get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36")
            .send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(users) = json["collection"].as_array() {
                    for u in users {
                        let username = u["username"].as_str().unwrap_or("").trim().to_lowercase();
                        if username == clean_name {
                            stats.soundcloud_followers = u["followers_count"].as_u64();
                            break;
                        }
                    }
                }
            }
        }
    }

    stats.spotify_followers = fetch_spotify_artist_followers(&artist_name, &state.http_client).await;

    Ok(stats)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]

#[tauri::command]
async fn search_vk_music(query: String, token: String, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let clean_query = query.trim();
    if clean_query.is_empty() { return Ok(Vec::new()); }

    let mut tracks = Vec::new();

    // 1. If user provided a VK token, search official VK API audio.search
    if !token.is_empty() {
        let url = format!(
            "https://api.vk.com/method/audio.search?q={}&count=30&access_token={}&v=5.131",
            urlencoding::encode(clean_query),
            token.trim()
        );
        if let Ok(res) = state.http_client.get(&url)
            .header("User-Agent", "KateMobileAndroid/108-lite (Android 11; SDK 30; arm64-v8a; Google Pixel 5; ru)")
            .send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(items) = json["response"]["items"].as_array() {
                    for t in items {
                        let owner_id = t["owner_id"].as_i64().unwrap_or(0);
                        let id_num = t["id"].as_i64().unwrap_or(0);
                        let id = format!("vk_{}_{}", owner_id, id_num);
                        let title = t["title"].as_str().unwrap_or("Unknown").to_string();
                        let artist = t["artist"].as_str().unwrap_or("Unknown").to_string();
                        let duration = t["duration"].as_u64().unwrap_or(0);
                        let url_str = t["url"].as_str().unwrap_or("").to_string();
                        
                        let thumb = t["album"]["thumb"]["photo_600"].as_str()
                            .or_else(|| t["album"]["thumb"]["photo_300"].as_str())
                            .or_else(|| t["album"]["thumb"]["photo_135"].as_str())
                            .unwrap_or("/vk_logo.png")
                            .to_string();

                        tracks.push(Track {
                            id,
                            title,
                            artist,
                            artist_id: None,
                            artists: None,
                            duration,
                            thumbnail: thumb,
                            source: "vk".to_string(),
                            stream_url: if url_str.is_empty() { None } else { Some(url_str) },
                            explanation: None,
                        });
                    }
                    if !tracks.is_empty() {
                        return Ok(tracks);
                    }
                }
            }
        }
    }

    // 2. Zero-Auth VK Music search: high quality instant stream
    let yt_results = search_youtube(format!("{} VK Music", clean_query), state.clone()).await.unwrap_or_default();
    for mut t in yt_results {
        t.source = "vk".to_string();
        if t.thumbnail.is_empty() {
            t.thumbnail = "/vk_logo.png".to_string();
        }
        tracks.push(t);
    }

    Ok(tracks)
}

async fn get_vk_audio_by_id_stream(audio_id_str: &str, token: &str, client: &reqwest::Client) -> Option<String> {
    let clean_token = token.trim();
    if clean_token.is_empty() { return None; }

    let raw_id = audio_id_str.strip_prefix("vk_").unwrap_or(audio_id_str);
    let url = format!(
        "https://api.vk.com/method/audio.getById?audios={}&access_token={}&v=5.131",
        raw_id, clean_token
    );

    for ua in &[VK_WEB_UA, VK_OFFICIAL_UA, VK_KATE_UA] {
        if let Ok(res) = client.get(&url).header("User-Agent", *ua).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(arr) = json["response"].as_array() {
                    if let Some(track_obj) = arr.first() {
                        if let Some(stream_url) = track_obj["url"].as_str() {
                            if stream_url.starts_with("http") {
                                return Some(stream_url.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
async fn get_vk_stream(track_id: String, title: Option<String>, artist: Option<String>, token: Option<String>, state: tauri::State<'_, AppState>) -> Result<String, String> {
    if track_id.len() == 11 && !track_id.starts_with("vk_") {
        return get_youtube_stream(track_id, state).await;
    }

    // 1. Query VK API audio.getById directly to get the official original VK audio stream URL
    if let Some(tok) = &token {
        if let Some(vk_url) = get_vk_audio_by_id_stream(&track_id, tok, &state.http_client).await {
            return Ok(vk_url);
        }
    }
    
    let t_str = title.unwrap_or_default();
    let a_str = artist.unwrap_or_default();
    let query = format!("{} {}", a_str, t_str).trim().to_string();
    
    // 2. Query YouTube (Official Audio) instead of SoundCloud covers
    if !query.is_empty() {
        let yt_query = format!("{} official audio", query);
        if let Ok(yt_results) = search_youtube(yt_query, state.clone()).await {
            if let Some(first) = yt_results.first() {
                if let Ok(yt_url) = get_youtube_stream(first.id.clone(), state.clone()).await {
                    if !yt_url.is_empty() {
                        return Ok(yt_url);
                    }
                }
            }
        }
        if let Ok(yt_results) = search_youtube(query.clone(), state.clone()).await {
            if let Some(first) = yt_results.first() {
                if let Ok(yt_url) = get_youtube_stream(first.id.clone(), state.clone()).await {
                    if !yt_url.is_empty() {
                        return Ok(yt_url);
                    }
                }
            }
        }
    }
    
    if track_id.len() == 11 {
        return get_youtube_stream(track_id, state).await;
    }
    
    Err("VK Audio stream not found".to_string())
}


#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VkArtistInfo {
    pub id: String,
    pub name: String,
    pub photo: String,
    pub followers: Option<u64>,
    pub tracks: Vec<Track>,
    pub albums: Vec<VkAlbumInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VkAlbumInfo {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub artist: String,
    pub track_count: u32,
}

const VK_WEB_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const VK_OFFICIAL_UA: &str = "VKAndroidApp/8.85-18872 (Android 13; SDK 33; arm64-v8a; Xiaomi 2201116PG; ru)";
const VK_KATE_UA: &str = "KateMobileAndroid/108-lite (Android 11; SDK 30; arm64-v8a; Google Pixel 5; ru)";

fn parse_vk_track(t: &serde_json::Value) -> Option<Track> {
    let target = if t["audio"].is_object() { &t["audio"] } else { t };
    let owner_id = target["owner_id"].as_i64().or_else(|| target["owner_id"].as_str().and_then(|s| s.parse().ok()))?;
    let id_num = target["id"].as_i64().or_else(|| target["id"].as_str().and_then(|s| s.parse().ok()))?;
    let id = format!("vk_{}_{}", owner_id, id_num);
    let title = target["title"].as_str().unwrap_or("Unknown").trim().to_string();
    let artist = target["artist"].as_str().unwrap_or("Unknown").trim().to_string();
    let duration = target["duration"].as_u64().unwrap_or(0);
    let url_str = target["url"].as_str().unwrap_or("").to_string();
    
    // Filter out corrupted / garbage track entries
    let is_garbage_title = title.is_empty()
        || title.chars().all(|c| c == '-' || c == '_' || c == '.' || c == ' ' || c.is_ascii_digit())
        || (title.len() >= 20 && title.chars().all(|c| c.is_ascii_hexdigit()));
    
    if is_garbage_title {
        return None;
    }
    
    let main_artists = target["main_artists"].as_array();
    let artist_id = main_artists
        .and_then(|arr| arr.first())
        .and_then(|a| a["id"].as_str().or_else(|| a["domain"].as_str()))
        .map(|s| s.to_string());
    
    let mut thumb = target["album"]["thumb"]["photo_1200"].as_str()
        .or_else(|| target["album"]["thumb"]["photo_600"].as_str())
        .or_else(|| target["album"]["thumb"]["photo_300"].as_str())
        .or_else(|| target["album"]["photo"]["photo_1200"].as_str())
        .or_else(|| target["album"]["photo"]["photo_600"].as_str())
        .or_else(|| target["album"]["photo"]["photo_300"].as_str())
        .or_else(|| target["photo_600"].as_str())
        .or_else(|| target["photo_300"].as_str())
        .or_else(|| target["album"]["thumb"]["photo_135"].as_str())
        .unwrap_or("")
        .to_string();

    if thumb.is_empty() {
        if let Some(covers) = target["track_covers"].as_array().or_else(|| target["thumbs"].as_array()) {
            if let Some(first) = covers.first() {
                if let Some(u) = first.as_str().or_else(|| first["photo_600"].as_str()).or_else(|| first["photo_300"].as_str()) {
                    thumb = u.to_string();
                }
            }
        }
    }

    if thumb.is_empty() {
        thumb = "/vk_logo.png".to_string();
    }
    
    Some(Track {
        id,
        title,
        artist,
        artist_id,
        artists: None,
        duration,
        thumbnail: thumb,
        source: "vk".to_string(),
        stream_url: if url_str.is_empty() { None } else { Some(url_str) },
        explanation: None,
    })
}

#[tauri::command]
async fn get_vk_artist(artist_id: String, token: String, state: tauri::State<'_, AppState>) -> Result<VkArtistInfo, String> {
    let clean_token = token.trim();
    if clean_token.is_empty() {
        return Err("VK token required".to_string());
    }
    
    // 1. Try catalog.getAudioArtist first
    let url = format!(
        "https://api.vk.com/method/catalog.getAudioArtist?artist_id={}&need_blocks=1&access_token={}&v=5.199",
        urlencoding::encode(&artist_id),
        clean_token
    );
    
    if let Ok(res) = state.http_client.get(&url)
        .header("User-Agent", VK_KATE_UA)
        .send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(resp) = json.get("response") {
                let mut artist_name = resp["artist"]["name"].as_str()
                    .or_else(|| resp["artist"]["title"].as_str())
                    .or_else(|| resp["catalog"]["default_section"].as_str())
                    .or_else(|| resp["title"].as_str())
                    .unwrap_or("")
                    .to_string();
                
                if artist_name.is_empty() || artist_name.chars().all(|c| c.is_ascii_digit()) {
                    artist_name = artist_id.clone();
                }

                let mut photo = resp["artist"]["photo_600"].as_str()
                    .or_else(|| resp["artist"]["photo_300"].as_str())
                    .or_else(|| resp["artist"]["photo"][0]["url"].as_str())
                    .or_else(|| resp["catalog"]["thumbnails"].as_array()
                        .and_then(|arr| arr.first())
                        .and_then(|t| t["photo_600"].as_str().or_else(|| t["photo_300"].as_str())))
                    .unwrap_or("")
                    .to_string();
                
                let mut tracks = Vec::new();
                let mut albums = Vec::new();
                
                if let Some(audios) = resp["audios"].as_array() {
                    for t in audios {
                        if let Some(mut track) = parse_vk_track(t) {
                            if track.thumbnail == "/vk_logo.png" {
                                if let Some(art) = fetch_itunes_artwork(&track.artist, &track.title, &state.http_client).await {
                                    track.thumbnail = art;
                                }
                            }
                            tracks.push(track);
                        }
                    }
                }
                
                if let Some(playlists) = resp["playlists"].as_array() {
                    for p in playlists {
                        let p_id = p["id"].as_i64().unwrap_or(0).to_string();
                        let p_title = p["title"].as_str().unwrap_or("Album").to_string();
                        let p_thumb = p["thumbs"].as_array()
                            .and_then(|arr| arr.first())
                            .and_then(|t| t["photo_600"].as_str().or_else(|| t["photo_300"].as_str()))
                            .or_else(|| p["photo"]["photo_600"].as_str())
                            .unwrap_or("/vk_logo.png")
                            .to_string();
                        let p_artist = p["main_artists"].as_array()
                            .and_then(|arr| arr.first())
                            .and_then(|a| a["name"].as_str())
                            .unwrap_or(&artist_name)
                            .to_string();
                        let p_count = p["count"].as_u64().unwrap_or(0) as u32;
                        
                        albums.push(VkAlbumInfo {
                            id: p_id,
                            title: p_title,
                            thumbnail: p_thumb,
                            artist: p_artist,
                            track_count: p_count,
                        });
                    }
                }
                
                if photo.is_empty() {
                    if let Some(first_trk) = tracks.first() {
                        photo = first_trk.thumbnail.clone();
                    } else if let Some(art) = fetch_itunes_artwork(&artist_name, "", &state.http_client).await {
                        photo = art;
                    }
                }

                if !tracks.is_empty() || !albums.is_empty() {
                    return Ok(VkArtistInfo {
                        id: artist_id,
                        name: artist_name,
                        photo,
                        followers: None,
                        tracks,
                        albums,
                    });
                }
            }
        }
    }

    // 2. Fallback: search by artist name via audio.search and enrich cover images
    let search_url = format!(
        "https://api.vk.com/method/audio.search?q={}&performer_only=1&count=50&access_token={}&v=5.131",
        urlencoding::encode(&artist_id),
        clean_token
    );
    
    if let Ok(res) = state.http_client.get(&search_url)
        .header("User-Agent", VK_KATE_UA)
        .send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(items) = json["response"]["items"].as_array() {
                let mut tracks = Vec::new();
                let mut found_name = artist_id.clone();
                let mut photo = String::new();

                for t in items {
                    if let Some(mut track) = parse_vk_track(t) {
                        if tracks.is_empty() {
                            found_name = track.artist.clone();
                            if track.thumbnail != "/vk_logo.png" {
                                photo = track.thumbnail.clone();
                            }
                        }
                        if track.thumbnail == "/vk_logo.png" {
                            if let Some(art) = fetch_itunes_artwork(&track.artist, &track.title, &state.http_client).await {
                                track.thumbnail = art;
                            }
                        }
                        tracks.push(track);
                    }
                }
                
                if photo.is_empty() {
                    if let Some(art) = fetch_itunes_artwork(&found_name, "", &state.http_client).await {
                        photo = art;
                    }
                }

                return Ok(VkArtistInfo {
                    id: artist_id,
                    name: found_name,
                    photo,
                    followers: None,
                    tracks,
                    albums: Vec::new(),
                });
            }
        }
    }
    
    Err("VK artist not found".to_string())
}

fn extract_vk_tracks_from_json(json: &serde_json::Value) -> Vec<Track> {
    let mut tracks = Vec::new();
    
    // 1. Direct array in response
    if let Some(arr) = json["response"].as_array() {
        for t in arr {
            if let Some(trk) = parse_vk_track(t) {
                tracks.push(trk);
            }
        }
        if !tracks.is_empty() { return tracks; }
    }
    
    // 2. response.items
    if let Some(arr) = json["response"]["items"].as_array() {
        for t in arr {
            if let Some(trk) = parse_vk_track(t) {
                tracks.push(trk);
            }
        }
        if !tracks.is_empty() { return tracks; }
    }
    
    // 3. response.audios
    if let Some(arr) = json["response"]["audios"].as_array() {
        for t in arr {
            if let Some(trk) = parse_vk_track(t) {
                tracks.push(trk);
            }
        }
        if !tracks.is_empty() { return tracks; }
    }
    
    // 4. response.blocks -> audios / items
    if let Some(blocks) = json["response"]["blocks"].as_array() {
        for b in blocks {
            let list = b["audios"].as_array().or_else(|| b["items"].as_array());
            if let Some(arr) = list {
                for t in arr {
                    if let Some(trk) = parse_vk_track(t) {
                        tracks.push(trk);
                    }
                }
            }
        }
        if !tracks.is_empty() { return tracks; }
    }

    // 5. Direct root array
    if let Some(arr) = json.as_array() {
        for t in arr {
            if let Some(trk) = parse_vk_track(t) {
                tracks.push(trk);
            }
        }
    }
    
    tracks
}

async fn get_vk_user_id_and_ua(token: &str, client: &reqwest::Client) -> (Option<i64>, &'static str) {
    let url = format!("https://api.vk.com/method/users.get?access_token={}&v=5.131", token);
    for ua in &[VK_OFFICIAL_UA, VK_KATE_UA, VK_WEB_UA] {
        if let Ok(res) = client.get(&url).header("User-Agent", *ua).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(arr) = json["response"].as_array() {
                    if let Some(user) = arr.first() {
                        if let Some(id) = user["id"].as_i64().or_else(|| user["id"].as_str().and_then(|s| s.parse().ok())) {
                            return (Some(id), *ua);
                        }
                    }
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    }
    (None, VK_KATE_UA)
}

#[allow(dead_code)]
fn shuffle_tracks(tracks: &mut Vec<Track>) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().subsec_nanos() as usize;
    let len = tracks.len();
    if len <= 1 { return; }
    for i in (1..len).rev() {
        let j = (nanos.wrapping_add(i * 31)) % (i + 1);
        tracks.swap(i, j);
    }
}

#[tauri::command]
async fn get_vk_recommendations(token: String, count: Option<u32>, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let clean_token = token.trim();
    let limit = count.unwrap_or(50);
    let mut rec_tracks = Vec::new();

    if !clean_token.is_empty() {
        // Probe token to get user ID and working User-Agent
        let (user_id_opt, working_ua) = get_vk_user_id_and_ua(clean_token, &state.http_client).await;

        // 1. Try audio.getStream (Official VK Mix endpoint)
        let get_stream_url = format!(
            "https://api.vk.com/method/audio.getStream?count={}&access_token={}&v=5.131",
            limit, clean_token
        );
        if let Ok(res) = state.http_client.get(&get_stream_url).header("User-Agent", working_ua).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if !json.get("error").is_some() {
                    rec_tracks = extract_vk_tracks_from_json(&json);
                }
            }
        }

        // 2. Try audio.getRecommendations (User library based recommendations)
        if rec_tracks.is_empty() {
            let rec_url = if let Some(uid) = user_id_opt {
                format!(
                    "https://api.vk.com/method/audio.getRecommendations?user_id={}&count={}&access_token={}&v=5.131",
                    uid, limit, clean_token
                )
            } else {
                format!(
                    "https://api.vk.com/method/audio.getRecommendations?count={}&access_token={}&v=5.131",
                    limit, clean_token
                )
            };
            if let Ok(res) = state.http_client.get(&rec_url).header("User-Agent", working_ua).send().await {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if !json.get("error").is_some() {
                        rec_tracks = extract_vk_tracks_from_json(&json);
                    }
                }
            }
        }

        // 3. Try catalog.getAudio section=recommended
        if rec_tracks.is_empty() {
            let cat_url = format!(
                "https://api.vk.com/method/catalog.getAudio?need_blocks=1&access_token={}&v=5.199",
                clean_token
            );
            if let Ok(res) = state.http_client.get(&cat_url).header("User-Agent", working_ua).send().await {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if !json.get("error").is_some() {
                        rec_tracks = extract_vk_tracks_from_json(&json);
                    }
                }
            }
        }
    }

    // 4. Guaranteed Fallback / Zero-Error VK Mix: Fetch popular trending VK tracks via search
    if rec_tracks.is_empty() {
        let popular_queries = ["Miyagi & Эндшпиль", "MACAN", "Баста", "XOLIDAYBOY", "ANNA ASTI", "Jakone", "A.V.G", "HammAli & Navai", "Гио Пика"];
        for q in popular_queries {
            if let Ok(search_res) = search_vk_music(q.to_string(), clean_token.to_string(), state.clone()).await {
                for t in search_res {
                    if !rec_tracks.iter().any(|existing| existing.id == t.id) {
                        rec_tracks.push(t);
                    }
                }
                if rec_tracks.len() >= 30 { break; }
            }
        }
    }

    if !rec_tracks.is_empty() {
        return Ok(rec_tracks);
    }

    Err("Не удалось загрузить рекомендации VK. Попробуйте обновить токен.".to_string())
}

#[tauri::command]
async fn get_vk_user_tracks(token: String, count: Option<u32>, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let clean_token = token.trim();
    if clean_token.is_empty() {
        return Ok(Vec::new());
    }
    
    let limit = count.unwrap_or(50);
    let url = format!(
        "https://api.vk.com/method/audio.get?count={}&access_token={}&v=5.131",
        limit,
        clean_token
    );
    
    if let Ok(res) = state.http_client.get(&url).header("User-Agent", VK_KATE_UA).send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            let tracks = extract_vk_tracks_from_json(&json);
            if !tracks.is_empty() {
                return Ok(tracks);
            }
        }
    }
    
    Ok(Vec::new())
}

#[tauri::command]
async fn vk_add_audio(token: String, owner_id: i64, audio_id: i64, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let clean_token = token.trim();
    if clean_token.is_empty() {
        return Err("VK token required".to_string());
    }
    
    let url = format!(
        "https://api.vk.com/method/audio.add?owner_id={}&audio_id={}&access_token={}&v=5.131",
        owner_id,
        audio_id,
        clean_token
    );
    
    let res = state.http_client.get(&url)
        .header("User-Agent", VK_KATE_UA)
        .send().await
        .map_err(|e| e.to_string())?;
    
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
if let Some(err) = json["error"]["error_msg"].as_str() {
        return Err(format!("VK error: {}", err));
    }
    
    Ok("ok".to_string())
}

async fn fetch_itunes_artwork(artist: &str, title: &str, client: &reqwest::Client) -> Option<String> {
    let query = format!("{} {}", artist, title);
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=1",
        urlencoding::encode(&query)
    );
    if let Ok(res) = client.get(&url).header("User-Agent", "Mozilla/5.0").send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(first) = json["results"].as_array().and_then(|a| a.first()) {
                if let Some(art) = first["artworkUrl100"].as_str() {
                    return Some(art.replace("100x100bb", "600x600bb"));
                }
            }
        }
    }
    None
}

#[tauri::command]
async fn get_lastfm_recommendations(limit: Option<u32>, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let count = limit.unwrap_or(30);
    
    // Top endpoints for CIS youth (зумеры) & Global Gen Z music
    let urls = vec![
        "https://ws.audioscrobbler.com/2.0/?method=geo.gettoptracks&country=russia&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=25".to_string(),
        "https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=hip-hop&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=20".to_string(),
        "https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=phonk&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=15".to_string(),
        "https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=pop&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=15".to_string(),
        "https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=20".to_string(),
    ];

    let mut raw_tracks = Vec::new();
    let mut seen_keys = std::collections::HashSet::new();

    for url in urls {
        if let Ok(res) = state.http_client.get(&url).header("User-Agent", "Mozilla/5.0").send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                let track_list = json["tracks"]["track"].as_array()
                    .or_else(|| json["toptracks"]["track"].as_array());

                if let Some(list) = track_list {
                    for t in list {
                        let title = t["name"].as_str().unwrap_or("").to_string();
                        let artist = if let Some(a_obj) = t["artist"].as_object() {
                            a_obj.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string()
                        } else if let Some(a_str) = t["artist"].as_str() {
                            a_str.to_string()
                        } else {
                            "".to_string()
                        };

                        if title.is_empty() || artist.is_empty() {
                            continue;
                        }

                        let key = format!("{}:{}", artist.to_lowercase(), title.to_lowercase());
                        if seen_keys.contains(&key) {
                            continue;
                        }
                        seen_keys.insert(key);

                        let mut thumbnail = String::new();
                        if let Some(images) = t["image"].as_array() {
                            for img in images.iter().rev() {
                                if let Some(src) = img["#text"].as_str() {
                                    if !src.is_empty() && !src.contains("2a96cbd8b46e442fc41c2b86b821562f") {
                                        thumbnail = src.to_string();
                                        break;
                                    }
                                }
                            }
                        }

                        let duration = t["duration"].as_str().and_then(|s| s.parse::<u64>().ok()).unwrap_or(180);
                        let id = format!("lfm_{}_{}", urlencoding::encode(&artist), urlencoding::encode(&title));

                        raw_tracks.push(Track {
                            id,
                            title,
                            artist,
                            artist_id: None,
                            artists: None,
                            duration,
                            thumbnail,
                            source: "lastfm".to_string(),
                            stream_url: None,
                            explanation: Some("Last.fm Recommendations".to_string()),
                        });

                        if raw_tracks.len() >= (count as usize) * 2 {
                            break;
                        }
                    }
                }
            }
        }
    }

    let mut final_tracks = Vec::new();
    for mut track in raw_tracks.into_iter().take(count as usize) {
        if track.thumbnail.is_empty() || track.thumbnail.contains("2a96cbd8b46e442fc41c2b86b821562f") {
            if let Some(art) = fetch_itunes_artwork(&track.artist, &track.title, &state.http_client).await {
                track.thumbnail = art;
            }
        }
        final_tracks.push(track);
    }
    Ok(final_tracks)
}

#[tauri::command]
async fn get_lastfm_new_releases(limit: Option<u32>, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let count = limit.unwrap_or(20);
    let url = format!(
        "https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=pop&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit={}",
        count
    );

    let res = state.http_client.get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send().await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut raw_tracks = Vec::new();
    if let Some(list) = json["tracks"]["track"].as_array() {
        for t in list {
            let title = t["name"].as_str().unwrap_or("").to_string();
            let artist = if let Some(a_obj) = t["artist"].as_object() {
                a_obj.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string()
            } else if let Some(a_str) = t["artist"].as_str() {
                a_str.to_string()
            } else {
                "".to_string()
            };

            if title.is_empty() || artist.is_empty() { continue; }

            let mut thumbnail = String::new();
            if let Some(images) = t["image"].as_array() {
                for img in images.iter().rev() {
                    if let Some(src) = img["#text"].as_str() {
                        if !src.is_empty() && !src.contains("2a96cbd8b46e442fc41c2b86b821562f") {
                            thumbnail = src.to_string();
                            break;
                        }
                    }
                }
            }

            let id = format!("lfm_rel_{}_{}", urlencoding::encode(&artist), urlencoding::encode(&title));

            raw_tracks.push(Track {
                id,
                title,
                artist,
                artist_id: None,
                artists: None,
                duration: 180,
                thumbnail,
                source: "lastfm".to_string(),
                stream_url: None,
                explanation: Some("Last.fm New Release".to_string()),
            });
        }
    }

    let mut final_tracks = Vec::new();
    for mut track in raw_tracks.into_iter().take(count as usize) {
        if track.thumbnail.is_empty() || track.thumbnail.contains("2a96cbd8b46e442fc41c2b86b821562f") {
            if let Some(art) = fetch_itunes_artwork(&track.artist, &track.title, &state.http_client).await {
                track.thumbnail = art;
            }
        }
        final_tracks.push(track);
    }
    Ok(final_tracks)
}

static RZT_CACHE: Mutex<Option<(Vec<Track>, std::time::Instant)>> = Mutex::new(None);

#[tauri::command]
async fn get_risazatvorchestvo_releases(limit: Option<u32>, state: tauri::State<'_, AppState>) -> Result<Vec<Track>, String> {
    let count = limit.unwrap_or(50);

    // Return cached releases if available and less than 1 hour old
    if let Ok(guard) = RZT_CACHE.lock() {
        if let Some((ref cached, ref timestamp)) = *guard {
            if timestamp.elapsed().as_secs() < 3600 && !cached.is_empty() {
                return Ok(cached.clone());
            }
        }
    }

    let url = "https://risazatvorchestvo.com/releases";
    let mut html = String::new();

    // 1. Try reqwest with full desktop browser headers
    if let Ok(res) = state.http_client.get(url)
        .timeout(std::time::Duration::from_secs(6))
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
        .header("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7")
        .send().await {
            if let Ok(text) = res.text().await {
                if text.len() > 50000 {
                    html = text;
                }
            }
    }

    // 2. Fallback to curl.exe without opening any console window on Windows
    if html.len() < 50000 {
        let mut cmd = std::process::Command::new("curl.exe");
        cmd.args(&[
            "-s", "-L", "--max-time", "6", url,
            "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "-H", "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
        ]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW: completely hides cmd window!
        }

        if let Ok(output) = cmd.output() {
            if let Ok(text) = String::from_utf8(output.stdout) {
                if text.len() > 50000 {
                    html = text;
                }
            }
        }
    }

    let mut tracks = Vec::new();
    if !html.is_empty() {
        let matches_re = regex::Regex::new(r#"data\\?":\{([^\n]*?type\\?":\\?"(?:track|album)\\?".*?)(?=\},"|\}\]\})"#).unwrap();
        let id_re = regex::Regex::new(r#""id":"(\d+)""#).unwrap();
        let type_re = regex::Regex::new(r#""type":"([^"]+)""#).unwrap();
        let title_re = regex::Regex::new(r#""title":"([^"]+)""#).unwrap();
        let thumb_re = regex::Regex::new(r#""thumbnail":"([^"]+)""#).unwrap();
        let artists_block_re = regex::Regex::new(r#""artists":\[(.*?)\]"#).unwrap();
        let artist_name_re = regex::Regex::new(r#""title":"([^"]+)""#).unwrap();
        let yandex_path_re = regex::Regex::new(r#""yandex_release_path":"([^"]+)""#).unwrap();
        let yandex_tr_re = regex::Regex::new(r#"/track/(\d+)"#).unwrap();
        let yandex_al_re = regex::Regex::new(r#"/album/(\d+)"#).unwrap();

        let mut seen_ids = std::collections::HashSet::new();

        for cap in matches_re.captures_iter(&html) {
            if let Some(m) = cap.get(1) {
                let raw_str = m.as_str().replace("\\\"", "\"").replace("\\/", "/");
                let rel_id = id_re.captures(&raw_str).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("");
                if rel_id.is_empty() || seen_ids.contains(rel_id) {
                    continue;
                }
                seen_ids.insert(rel_id.to_string());

                let rel_type = type_re.captures(&raw_str).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("track");
                let rel_title = title_re.captures(&raw_str).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("");
                let rel_thumb = thumb_re.captures(&raw_str).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("");

                if rel_title.is_empty() {
                    continue;
                }

                let mut artist_names = Vec::new();
                if let Some(ablock) = artists_block_re.captures(&raw_str) {
                    let ablock_str = ablock.get(1).map(|m| m.as_str()).unwrap_or("");
                    for acap in artist_name_re.captures_iter(ablock_str) {
                        if let Some(aname) = acap.get(1) {
                            artist_names.push(aname.as_str().to_string());
                        }
                    }
                }

                let artist_str = if artist_names.is_empty() {
                    "Неизвестный исполнитель".to_string()
                } else {
                    artist_names.join(", ")
                };

                let yandex_path = yandex_path_re.captures(&raw_str).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("");
                let yandex_track_id = if !yandex_path.is_empty() {
                    yandex_tr_re.captures(yandex_path).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("")
                } else {
                    ""
                };
                let yandex_album_id = if !yandex_path.is_empty() {
                    yandex_al_re.captures(yandex_path).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("")
                } else {
                    ""
                };

                let clean_title = serde_json::from_str::<String>(&format!("\"{}\"", rel_title)).unwrap_or_else(|_| rel_title.to_string());
                let clean_artist = serde_json::from_str::<String>(&format!("\"{}\"", artist_str)).unwrap_or_else(|_| artist_str.to_string());

                let mut explanation = format!("Релиз RZT ({})", rel_type);
                if !yandex_track_id.is_empty() {
                    explanation.push_str(&format!("|yandex_track:{}", yandex_track_id));
                }
                if !yandex_album_id.is_empty() {
                    explanation.push_str(&format!("|yandex_album:{}", yandex_album_id));
                }
                if rel_type == "album" {
                    explanation.push_str("|is_album:1");
                }

                tracks.push(Track {
                    id: format!("rzt_{}", rel_id),
                    title: clean_title,
                    artist: clean_artist,
                    artist_id: if !yandex_album_id.is_empty() { Some(yandex_album_id.to_string()) } else { None },
                    artists: None,
                    duration: 180,
                    thumbnail: rel_thumb.to_string(),
                    source: "rzt".to_string(),
                    stream_url: if !yandex_track_id.is_empty() { Some(yandex_track_id.to_string()) } else { None },
                    explanation: Some(explanation),
                });

                if tracks.len() >= (count as usize) {
                    break;
                }
            }
        }
    }

    if tracks.is_empty() {
        // Fallback to cache if available
        if let Ok(guard) = RZT_CACHE.lock() {
            if let Some((ref cached, _)) = *guard {
                if !cached.is_empty() {
                    return Ok(cached.clone());
                }
            }
        }
        tracks = get_default_rzt_releases();
    }

    if let Ok(mut guard) = RZT_CACHE.lock() {
        *guard = Some((tracks.clone(), std::time::Instant::now()));
    }

    Ok(tracks)
}

fn get_default_rzt_releases() -> Vec<Track> {
    vec![
        Track { id: "rzt_86937".to_string(), title: "Шуйский Лён".to_string(), artist: "Anonymous Ember, tuborosho".to_string(), artist_id: Some("43070018".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20608190/83d5ad84.a.43070018-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153663702".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153663702|yandex_album:43070018".to_string()) },
        Track { id: "rzt_86903".to_string(), title: "Да это так".to_string(), artist: "Voskresenskii, Wipo".to_string(), artist_id: Some("43070016".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/18172800/f4cf3ef7.a.43070016-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153663703".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153663703|yandex_album:43070016".to_string()) },
        Track { id: "rzt_86900".to_string(), title: "Два инцела".to_string(), artist: "Хаски, Зангези".to_string(), artist_id: Some("43047900".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17659805/aa4e6c95.a.43047900-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153614010".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153614010|yandex_album:43047900".to_string()) },
        Track { id: "rzt_86898".to_string(), title: "ВОЛОГДА".to_string(), artist: "MAYOT, Police In Paris".to_string(), artist_id: Some("43048680".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20189877/f562d176.a.43048680-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:43048680|is_album:1".to_string()) },
        Track { id: "rzt_86914".to_string(), title: "КУКЛА".to_string(), artist: "uniqe".to_string(), artist_id: Some("43070023".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20900757/a9c9a5fa.a.43070023-1/1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153663707".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153663707|yandex_album:43070023".to_string()) },
        Track { id: "rzt_86895".to_string(), title: "Кино".to_string(), artist: "ФРИК ПАТИ".to_string(), artist_id: Some("43021220".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17674835/9da71b98.a.43021220-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153548269".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153548269|yandex_album:43021220".to_string()) },
        Track { id: "rzt_86890".to_string(), title: "ОФСАЙД".to_string(), artist: "KURT92".to_string(), artist_id: Some("42818189".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20113429/68c23ec1.a.42818189-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:42818189|is_album:1".to_string()) },
        Track { id: "rzt_86888".to_string(), title: "И так и сяк".to_string(), artist: "ЗоХа".to_string(), artist_id: Some("43057874".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20322863/7f05eba2.a.43057874-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153636134".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153636134|yandex_album:43057874".to_string()) },
        Track { id: "rzt_86886".to_string(), title: "Губы целуют".to_string(), artist: "FEDUK".to_string(), artist_id: Some("43055089".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17674835/fc58e904.a.43055089-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153630766".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153630766|yandex_album:43055089".to_string()) },
        Track { id: "rzt_86884".to_string(), title: "Мой Близи На Красном".to_string(), artist: "4n Way".to_string(), artist_id: Some("43046648".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20622967/7b38147c.a.43046648-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:43046648|is_album:1".to_string()) },
        Track { id: "rzt_86882".to_string(), title: "SELF MADE".to_string(), artist: "Минин".to_string(), artist_id: Some("42876226".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20013662/7e32b343.a.42876226-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:42876226|is_album:1".to_string()) },
        Track { id: "rzt_86880".to_string(), title: "Мысли".to_string(), artist: "Тима Белорусских".to_string(), artist_id: Some("42962591".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20322863/0e4ba394.a.42962591-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153410062".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153410062|yandex_album:42962591".to_string()) },
        Track { id: "rzt_86878".to_string(), title: "вселенная".to_string(), artist: "LIZER".to_string(), artist_id: Some("42893056".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/19999910/a5ff1e79.a.42893056-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153244261".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153244261|yandex_album:42893056".to_string()) },
        Track { id: "rzt_86876".to_string(), title: "BBQ".to_string(), artist: "5opka".to_string(), artist_id: Some("42930313".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20840698/7e126422.a.42930313-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153337559".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153337559|yandex_album:42930313".to_string()) },
        Track { id: "rzt_86855".to_string(), title: "SEVER 2".to_string(), artist: "elox1m".to_string(), artist_id: Some("42903260".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17730916/3809da5a.a.42903260-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:42903260|is_album:1".to_string()) },
        Track { id: "rzt_86853".to_string(), title: "PULAPOVICH CORE".to_string(), artist: "HELLOVERCAVI".to_string(), artist_id: Some("43055098".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20372582/8a79ecab.a.43055098-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:43055098|is_album:1".to_string()) },
        Track { id: "rzt_86848".to_string(), title: "DMTCORE".to_string(), artist: "dmtboy".to_string(), artist_id: Some("42900566".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/19752797/d42ea6ca.a.42900566-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:42900566|is_album:1".to_string()) },
        Track { id: "rzt_86869".to_string(), title: "любовь / война".to_string(), artist: "huzzy b".to_string(), artist_id: Some("42964318".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20031403/117e02f8.a.42964318-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153414918".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153414918|yandex_album:42964318".to_string()) },
        Track { id: "rzt_86843".to_string(), title: "Твоим".to_string(), artist: "Шайни".to_string(), artist_id: Some("43056544".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20372582/e36f09b7.a.43056544-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153633475".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153633475|yandex_album:43056544".to_string()) },
        Track { id: "rzt_86835".to_string(), title: "пупы шмупы".to_string(), artist: "Lida".to_string(), artist_id: Some("43046645".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20113429/f3cab2a7.a.43046645-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153610371".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153610371|yandex_album:43046645".to_string()) },
        Track { id: "rzt_86826".to_string(), title: "roman".to_string(), artist: "NEWLIGHTCHILD".to_string(), artist_id: Some("42966290".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17674835/64f21454.a.42966290-3/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153419778".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153419778|yandex_album:42966290".to_string()) },
        Track { id: "rzt_86864".to_string(), title: "trial".to_string(), artist: "Sqwore".to_string(), artist_id: Some("42988193".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/19999910/e2967ce7.a.42988193-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:42988193|is_album:1".to_string()) },
        Track { id: "rzt_86833".to_string(), title: "Сталкер".to_string(), artist: "Scally Milano".to_string(), artist_id: Some("43055093".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20013662/2daa9e9f.a.43055093-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153630771".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153630771|yandex_album:43055093".to_string()) },
        Track { id: "rzt_86837".to_string(), title: "Общество Мертвых Поэтов".to_string(), artist: "Aarne, VILLIAN".to_string(), artist_id: Some("43106455".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17699177/3e51b375.a.43106455-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153751510".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153751510|yandex_album:43106455".to_string()) },
        Track { id: "rzt_86859".to_string(), title: "Шабаш".to_string(), artist: "Лолита, ICEGERGERT".to_string(), artist_id: Some("43067216".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17699177/57ef70ed.a.43067216-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153657247".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153657247|yandex_album:43067216".to_string()) },
        Track { id: "rzt_86841".to_string(), title: "Последний танец".to_string(), artist: "Heronwater".to_string(), artist_id: Some("43106454".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17770778/4b80a36d.a.43106454-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153751509".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153751509|yandex_album:43106454".to_string()) },
        Track { id: "rzt_86845".to_string(), title: "Во все принцы".to_string(), artist: "Maladoy Prince, Слава КПСС".to_string(), artist_id: Some("43021209".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20322863/3543dda1.a.43021209-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153548256".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153548256|yandex_album:43021209".to_string()) },
        Track { id: "rzt_86909".to_string(), title: "Bon Pari".to_string(), artist: "Mav-d, Bufo".to_string(), artist_id: Some("43011197".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20840698/20fd1b50.a.43011197-1/1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:43011197|is_album:1".to_string()) },
        Track { id: "rzt_86912".to_string(), title: "Show stopper".to_string(), artist: "Glocki52".to_string(), artist_id: Some("42758147".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17655650/ce446bd3.a.42758147-1/1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("152926895".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:152926895|yandex_album:42758147".to_string()) },
        Track { id: "rzt_86893".to_string(), title: "Стены".to_string(), artist: "Атам".to_string(), artist_id: Some("42990169".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/19999910/ed744863.a.42990169-2/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153477392".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153477392|yandex_album:42990169".to_string()) },
        Track { id: "rzt_86820".to_string(), title: "БАУНС".to_string(), artist: "the pak, Taly".to_string(), artist_id: Some("42780280".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20322863/13e5e12e.a.42780280-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: None, explanation: Some("Релиз RZT (album)|yandex_album:42780280|is_album:1".to_string()) },
        Track { id: "rzt_86225".to_string(), title: "пройдёт".to_string(), artist: "такнельзя".to_string(), artist_id: Some("42165688".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17649213/da609596.a.42165688-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("151578558".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:151578558|yandex_album:42165688".to_string()) },
        Track { id: "rzt_86931".to_string(), title: "Кроме нас".to_string(), artist: "TROFIM GRANN".to_string(), artist_id: Some("41105939".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/16406615/ddbddbdb.a.41105939-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("149158729".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:149158729|yandex_album:41105939".to_string()) },
        Track { id: "rzt_86929".to_string(), title: "baby my type".to_string(), artist: "TAKETAKE".to_string(), artist_id: Some("41529159".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/19999910/496f787a.a.41529159-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("150142195".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:150142195|yandex_album:41529159".to_string()) },
        Track { id: "rzt_86927".to_string(), title: "мне страшно".to_string(), artist: "никому не говори".to_string(), artist_id: Some("42482167".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/17740720/bde8e7d0.a.42482167-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("152300489".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:152300489|yandex_album:42482167".to_string()) },
        Track { id: "rzt_86925".to_string(), title: "blood c".to_string(), artist: "империя зла".to_string(), artist_id: Some("42653462".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/18132539/6116cbb6.a.42653462-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("152702200".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:152702200|yandex_album:42653462".to_string()) },
        Track { id: "rzt_86923".to_string(), title: "СВЕТ".to_string(), artist: "ШОРОХ".to_string(), artist_id: Some("42870873".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20840698/f7208665.a.42870873-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153191365".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153191365|yandex_album:42870873".to_string()) },
        Track { id: "rzt_86921".to_string(), title: "Где бы ни был ты".to_string(), artist: "Dixaddy".to_string(), artist_id: Some("42975704".to_string()), artists: None, duration: 180, thumbnail: "https://avatars.yandex.net/get-music-content/20372582/34b85ced.a.42975704-1/m1000x1000".to_string(), source: "rzt".to_string(), stream_url: Some("153443925".to_string()), explanation: Some("Релиз RZT (track)|yandex_track:153443925|yandex_album:42975704".to_string()) },
    ]
}

pub fn run() {
    let http_client = reqwest::Client::builder()
        .pool_max_idle_per_host(25)
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36")
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
            stream_cache: Mutex::new(std::collections::HashMap::new()),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            search_yandex,
            get_yandex_stream,
            search_soundcloud,
            search_vk_music,
            get_vk_stream,
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
            start_vk_oauth,
            cache_liked_track,
            check_cached_track,
            delete_cached_track,
            get_soundcloud_similar,
            get_yandex_playlist_info,
            search_youtube,
            get_youtube_stream,
            get_artist_platform_stats,
            get_vk_artist,
            get_vk_recommendations,
            get_vk_user_tracks,
            vk_add_audio,
            get_lastfm_recommendations,
            get_lastfm_new_releases,
            get_risazatvorchestvo_releases
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
