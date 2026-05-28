import re

file_path = "/home/zero/.gemini/antigravity/brain/ad44a5ef-1229-4c32-a2e1-0b4cbcb78e05/.system_generated/steps/386/content.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

idx = content.find("/api/escrow/agent-rentals")
if idx != -1:
    print(content[idx-300:idx+2500].replace("\\n", "\n").replace("\\\"", "\""))
