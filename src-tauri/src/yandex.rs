use crate::{Track, LyricLine};
use serde_json::Value;

const BASE: &str = "https://api.music.yandex.net";
const TIMEOUT: u64 = 10;

fn headers(token: &str) -> Vec<(String, String)> {
    vec![
        ("Authorization".into(), format!("OAuth {}", token)),
        ("User-Agent".into(), "Yandex-Music-API/2.0".into()),
        ("Accept".into(), "application/json".into()),
    ]
}

fn parse_track(t: &Value) -> Option<Track> {
    let id = t.get("id")?.as_i64()?.to_string();
    let title = t.get("title")?.as_str()?.to_string();
    let artists = t.get("artists")?.as_array()?;
    let artist: String = artists
        .iter()
        .filter_map(|a| a.get("name")?.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let cover = t.get("coverUri")?.as_str()?;
    let thumbnail = format!("https://{}", cover.replace("%%", "400x400"));
    let duration_ms = t.get("durationMs")?.as_f64()?;
    Some(Track {
        id,
        title,
        artist,
        source: "yandex".into(),
        thumbnail: Some(thumbnail),
        duration: Some(duration_ms / 1000.0),
    })
}

pub async fn search(query: &str, token: &str) -> Result<Vec<Track>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/search?text={}&type=track&page=0&pageSize=20",
        BASE,
        urlencoding::encode(query)
    );
    let resp = client
        .get(&url)
        .headers(
            headers(token)
                .into_iter()
                .map(|(k, v)| (k.parse().unwrap(), v.parse().unwrap()))
                .collect(),
        )
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    let results = json
        .pointer("/result/tracks/results")
        .or_else(|| json.pointer("/result/tracks/items"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(results.iter().filter_map(parse_track).collect())
}

pub async fn get_stream_url(track_id: &str, token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/tracks/{}/download-info", BASE, track_id);
    let resp = client
        .get(&url)
        .headers(
            headers(token)
                .into_iter()
                .map(|(k, v)| (k.parse().unwrap(), v.parse().unwrap()))
                .collect(),
        )
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    let arr = json["result"].as_array().ok_or("No download info")?;
    let info = arr
        .iter()
        .find(|i| i["codec"].as_str() == Some("mp3"))
        .or_else(|| arr.first())
        .ok_or("No suitable codec")?;
    let download_url = info["downloadInfoUrl"]
        .as_str()
        .ok_or("No download URL")?;

    let xml_resp = client
        .get(download_url)
        .headers(
            headers(token)
                .into_iter()
                .map(|(k, v)| (k.parse().unwrap(), v.parse().unwrap()))
                .collect(),
        )
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let xml = xml_resp.text().await.map_err(|e| e.to_string())?;

    let extract = |tag: &str| -> Option<String> {
        let pattern = format!("<{}>(.*?)</{}>", tag, tag);
        let re = regex::Regex::new(&pattern).ok()?;
        let caps = re.captures(&xml)?;
        caps.get(1).map(|m| m.as_str().to_string())
    };

    let host = extract("host").ok_or("No host")?;
    let path = extract("path").ok_or("No path")?;
    let ts = extract("ts").ok_or("No ts")?;
    let s = extract("s").ok_or("No s")?;

    let path_clean = path.strip_prefix('/').unwrap_or(&path);
    let hash_input = format!("XGRlBW9FXlekgbPrRHuSiA{}{}", path_clean, s);
    let hash = format!("{:x}", md5::compute(hash_input));

    Ok(format!("https://{}/get-mp3/{}/{}{}", host, hash, ts, path))
}

pub async fn get_lyrics(track_id: &str, token: &str) -> Result<Vec<LyricLine>, String> {
    let client = reqwest::Client::new();
    let urls = vec![
        format!("{}/tracks/{}/lyrics?format=LRC&timeStamped=true", BASE, track_id),
        format!("{}/tracks/{}/supplement", BASE, track_id),
    ];

    for url in urls {
        if let Ok(resp) = client
            .get(&url)
            .headers(
                headers(token)
                    .into_iter()
                    .map(|(k, v)| (k.parse().unwrap(), v.parse().unwrap()))
                    .collect(),
            )
            .timeout(std::time::Duration::from_secs(TIMEOUT))
            .send()
            .await
        {
            if let Ok(json) = resp.json::<Value>().await {
                let download_url = json["result"]["lyrics"]["downloadUrl"]
                    .as_str()
                    .or_else(|| json["result"]["downloadUrl"].as_str());
                if let Some(durl) = download_url {
                    if let Ok(lrc_resp) = client
                        .get(durl)
                        .timeout(std::time::Duration::from_secs(TIMEOUT))
                        .send()
                        .await
                    {
                        if let Ok(lrc_text) = lrc_resp.text().await {
                            let lines = parse_lrc(&lrc_text);
                            if !lines.is_empty() {
                                return Ok(lines);
                            }
                        }
                    }
                }
                if let Some(full) = json["result"]["lyrics"]["fullLyrics"]
                    .as_str()
                    .or_else(|| json["result"]["fullLyrics"].as_str())
                    .or_else(|| json["result"]["lyrics"]["text"].as_str())
                {
                    let lines = parse_lrc(full);
                    if !lines.is_empty() {
                        return Ok(lines);
                    }
                    return Ok(full
                        .lines()
                        .filter(|l| !l.trim().is_empty())
                        .map(|l| LyricLine {
                            text: l.to_string(),
                            time: None,
                            duration: None,
                        })
                        .collect());
                }
            }
        }
    }
    Ok(vec![])
}

fn parse_lrc(text: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    let re = regex::Regex::new(r"\[(\d+):(\d+)[.:](\d+)\]").ok();
    let plain_re = regex::Regex::new(r"\[(\d+):(\d+)\]").ok();

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }

        let mut times = Vec::new();
        if let Some(re) = &re {
            for cap in re.captures_iter(line) {
                let min: f64 = cap[1].parse().unwrap_or(0.0);
                let sec: f64 = cap[2].parse().unwrap_or(0.0);
                let cs_str = &cap[3];
                let ms: f64 = cs_str.parse().unwrap_or(0.0);
                let ms = if cs_str.len() == 1 {
                    ms * 100.0
                } else if cs_str.len() == 2 {
                    ms * 10.0
                } else {
                    ms
                };
                times.push(min * 60.0 + sec + ms / 1000.0);
            }
        }

        if times.is_empty() {
            if let Some(pm) = plain_re.as_ref().and_then(|r| r.captures(line)) {
                let min: f64 = pm[1].parse().unwrap_or(0.0);
                let sec: f64 = pm[2].parse().unwrap_or(0.0);
                let content = line[pm[0].len()..].trim().to_string();
                if !content.is_empty() {
                    lines.push(LyricLine {
                        text: content,
                        time: Some(min * 60.0 + sec),
                        duration: None,
                    });
                }
            } else if !line.starts_with('[') {
                lines.push(LyricLine {
                    text: line.to_string(),
                    time: None,
                    duration: None,
                });
            }
            continue;
        }

        let content = line
            .replace(|c: char| c == '[' || c == ']', "")
            .split(|c: char| c.is_ascii_digit() || c == ':' || c == '.' || c == ',')
            .last()
            .unwrap_or("")
            .trim()
            .to_string();
        let content = if content.is_empty() {
            // Extract text after all timestamps
            let re2 = regex::Regex::new(r"\[\d+:\d+[.:]\d+\]").ok();
            if let Some(re2) = re2 {
                re2.replace_all(line, "").trim().to_string()
            } else {
                line.to_string()
            }
        } else {
            content
        };

        for t in times {
            lines.push(LyricLine {
                text: content.clone(),
                time: Some(t),
                duration: None,
            });
        }
    }

    // Calculate durations
    for i in 0..lines.len() {
        if let Some(t) = lines[i].time {
            let next = lines.get(i + 1).and_then(|l| l.time).unwrap_or(t + 5.0);
            lines[i].duration = Some(next - t);
        }
    }

    lines
}
