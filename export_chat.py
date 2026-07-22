import json
import os

log_path = r"C:\Users\dahma\.gemini\antigravity-ide\brain\1c9466f9-60a1-4f41-b730-4268a6cf98f4\.system_generated\logs\transcript_full.jsonl"
desktop_md_path = r"C:\Users\dahma\Desktop\chat_history.md"
desktop_txt_path = r"C:\Users\dahma\Desktop\chat_history.txt"

formatted_lines = []
formatted_lines.append("# История диалога\n")

if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                step_type = data.get("type", "")
                source = data.get("source", "")
                content = data.get("content", "")
                
                # Check for user input
                if step_type == "USER_INPUT" or source == "USER_EXPLICIT":
                    if content:
                        # Clean system tags if any
                        if "<SYSTEM_MESSAGE>" in content:
                            continue
                        if "<USER_REQUEST>" in content:
                            import re
                            req_match = re.search(r'<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>', content, re.DOTALL)
                            if req_match:
                                req_text = req_match.group(1).strip()
                                if req_text:
                                    formatted_lines.append(f"### 👤 Пользователь:\n{req_text}\n")
                        else:
                            formatted_lines.append(f"### 👤 Пользователь:\n{content.strip()}\n")
                            
                # Check for model response
                elif step_type == "PLANNER_RESPONSE" or source == "MODEL":
                    if content and not content.startswith("<thought>"):
                        # Extract non-thought model response
                        text = content
                        if "</thought>" in text:
                            text = text.split("</thought>")[-1]
                        text = text.strip()
                        if text:
                            formatted_lines.append(f"### 🤖 Ассистент:\n{text}\n")
            except Exception as e:
                pass

full_text = "\n".join(formatted_lines)

with open(desktop_md_path, "w", encoding="utf-8") as f:
    f.write(full_text)

with open(desktop_txt_path, "w", encoding="utf-8") as f:
    f.write(full_text)

print(f"Chat successfully exported to Desktop: {desktop_md_path} and {desktop_txt_path}")
