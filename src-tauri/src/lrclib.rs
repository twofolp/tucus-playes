use crate::LyricLine;
use serde_json::Value;

const BASE: &str = "https://lrclib.net/api";

pub async fn search(track_id: &str, source: &str) -> Result<Vec<LyricLine>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/get?track_name={}", BASE, urlencoding::encode(track_id));
    let resp = client
        .get(&url)
        .header("User-Agent", "TucusRN/1.0")
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(vec![]);
    }
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    parse_lrclib(&json)
}

fn parse_lrclib(json: &Value) -> Result<Vec<LyricLine>, String> {
    if let Some(synced) = json["syncedLyrics"].as_str() {
        let lines = parse_lrc(synced);
        if !lines.is_empty() {
            return Ok(lines);
        }
    }
    if let Some(plain) = json["plainLyrics"].as_str() {
        let lines: Vec<LyricLine> = plain
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| LyricLine {
                text: l.to_string(),
                time: None,
                duration: None,
            })
            .collect();
        if !lines.is_empty() {
            return Ok(lines);
        }
    }
    Ok(vec![])
}

fn parse_lrc(text: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    let re = regex::Regex::new(r"\[(\d+):(\d+)[.:](\d+)\]").ok();

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
            continue;
        }
        let content = re
            .as_ref()
            .map(|r| r.replace_all(line, "").trim().to_string())
            .unwrap_or_default();
        for t in times {
            lines.push(LyricLine {
                text: content.clone(),
                time: Some(t),
                duration: None,
            });
        }
    }
    for i in 0..lines.len() {
        if let Some(t) = lines[i].time {
            let next = lines.get(i + 1).and_then(|l| l.time).unwrap_or(t + 5.0);
            lines[i].duration = Some(next - t);
        }
    }
    lines
}
