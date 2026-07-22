use crate::Track;
use serde_json::Value;

const TIMEOUT: u64 = 8;

static mut CACHED_CLIENT_ID: Option<String> = None;
static mut CLIENT_ID_EXPIRY: u64 = 0;

const FALLBACK_IDS: &[&str] = &[
    "a3e059563d7fd3372b49b37f00a00bcf",
    "2t9loNQH90kzJcsF6jGLssKfJaNuISww",
    "b45b1aa10f1ac2941910a7f0d10f8e28",
];

fn parse_track(t: &Value) -> Option<Track> {
    let id = t.get("id")?.as_i64()?.to_string();
    let title = t.get("title")?.as_str()?.to_string();
    let artist = t
        .pointer("/user/username")?
        .as_str()?
        .to_string();
    let artwork = t.get("artwork_url").and_then(|v| v.as_str());
    let user_avatar = t.pointer("/user/avatar_url").and_then(|v| v.as_str());
    let thumbnail = artwork
        .map(|a| a.replace("-large.", "-t500x500."))
        .or_else(|| user_avatar.map(String::from));
    let duration_ms = t.get("duration")?.as_f64()?;
    Some(Track {
        id,
        title,
        artist,
        source: "soundcloud".into(),
        thumbnail,
        duration: Some(duration_ms / 1000.0),
    })
}

async fn get_client_id() -> Result<String, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    unsafe {
        if let Some(ref id) = CACHED_CLIENT_ID {
            if now < CLIENT_ID_EXPIRY {
                return Ok(id.clone());
            }
        }
    }

    let client = reqwest::Client::new();
    for id in FALLBACK_IDS {
        let url = format!(
            "https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id={}",
            id
        );
        if let Ok(resp) = client
            .get(&url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            if resp.status().is_success() {
                let id_owned = id.to_string();
                unsafe {
                    CACHED_CLIENT_ID = Some(id_owned.clone());
                    CLIENT_ID_EXPIRY = now + 3600000;
                }
                return Ok(id_owned);
            }
        }
    }
    Err("SoundCloud unavailable".into())
}

pub async fn search(query: &str) -> Result<Vec<Track>, String> {
    let client_id = get_client_id().await?;
    let client = reqwest::Client::new();
    let url = format!(
        "https://api-v2.soundcloud.com/search/tracks?q={}&client_id={}&limit=20",
        urlencoding::encode(query),
        client_id
    );
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    let tracks = json["collection"]
        .as_array()
        .map(|arr| arr.iter().filter_map(parse_track).collect())
        .unwrap_or_default();
    Ok(tracks)
}

pub async fn get_stream_url(track_id: &str) -> Result<String, String> {
    let client_id = get_client_id().await?;
    let client = reqwest::Client::new();
    let url = format!(
        "https://api-v2.soundcloud.com/tracks/{}?client_id={}",
        track_id, client_id
    );
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    let transcodings = json["media"]["transcodings"]
        .as_array()
        .ok_or("No transcodings")?;
    let transcoding = transcodings
        .iter()
        .find(|t| t["format"]["protocol"].as_str() == Some("progressive"))
        .or_else(|| transcodings.first())
        .ok_or("No suitable format")?;
    let t_url = transcoding["url"].as_str().ok_or("No URL")?;

    let stream_resp = client
        .get(format!("{}?client_id={}", t_url, client_id))
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let stream_json: Value = stream_resp.json().await.map_err(|e| e.to_string())?;
    stream_json["url"]
        .as_str()
        .or_else(|| stream_json["location"].as_str())
        .map(String::from)
        .ok_or("No stream URL".into())
}
