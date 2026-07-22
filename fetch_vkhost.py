import urllib.request, re

url = "https://vkhost.github.io/"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
try:
    with urllib.request.urlopen(req) as res:
        html = res.read().decode("utf-8", errors="ignore")
        for line in html.split("\n"):
            if "oauth.vk.com" in line or "client_id" in line or "Марус" in line or "marus" in line.lower():
                print(line.strip())
except Exception as e:
    print("Failed:", e)
