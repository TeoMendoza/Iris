#!/Library/Frameworks/Python.framework/Versions/3.11/bin/python3
import os
import time
import json
import base64
import requests
import anthropic
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SPACETIME_URL = os.environ["SPACETIME_URL"]
DB_NAME = os.environ["DB_NAME"]
VISION_KEY = os.environ["VISION_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

_anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

TOKEN_FILE = Path(".vision_token")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def _call(reducer: str, args: list, token: str) -> requests.Response:
    url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/call/{reducer}"
    resp = requests.post(url, headers=_headers(token), json=args)
    if not resp.ok:
        print(f"_call {reducer} failed {resp.status_code}: {resp.text}")
    resp.raise_for_status()
    return resp

def _sql(query: str, token: str) -> list[dict]:
    url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/sql"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "text/plain"}
    resp = requests.post(url, headers=headers, data=query)
    resp.raise_for_status()
    results = resp.json()
    if not results:
        return []
    result = results[0]
    columns = [el["name"]["some"] for el in result["schema"]["elements"]]
    return [dict(zip(columns, row)) for row in result["rows"]]


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

def load_stored() -> tuple[str, str] | None:
    if not TOKEN_FILE.exists():
        return None
    try:
        data = json.loads(TOKEN_FILE.read_text())
        return data["token"], data["key"]
    except Exception:
        return None

def save_token(token: str):
    TOKEN_FILE.write_text(json.dumps({"token": token, "key": VISION_KEY}))

def acquire_token() -> str:
    r = requests.post(f"{SPACETIME_URL}/v1/identity")
    r.raise_for_status()
    token = r.json()["token"]

    reg_url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/call/register_vision_client"
    reg_resp = requests.post(reg_url, headers=_headers(token), json=[VISION_KEY])
    reg_resp.raise_for_status()
    return token


# ---------------------------------------------------------------------------
# Reducers
# ---------------------------------------------------------------------------

def claim_images(token: str):
    _call("claim_images", [], token)

def _enum(variant: str) -> dict:
    return {variant[0].lower() + variant[1:]: []}

def submit_processed_image(token: str, processing_id: int, category: str, condition: str, price: float):
    _call("submit_processed_image", [processing_id, _enum(category), _enum(condition), price], token)


# ---------------------------------------------------------------------------
# Table queries
# ---------------------------------------------------------------------------

def fetch_processing_images(token: str) -> list[dict]:
    return _sql("SELECT * FROM processing_image", token)


# ---------------------------------------------------------------------------
# Vision prompt — edit here
# ---------------------------------------------------------------------------

VISION_PROMPT = """\
Analyze this image and classify the item(s) shown. Return a JSON object with exactly these fields:

{
  "category":  "<value>",
  "condition": "<value>",
  "price":     <number>
}

Allowed values:
  category:  "Clothing" | "Footwear" | "Electronics" | "Furniture" | "Food" | "Books" | "Tools" | "Toys" | "Misc"
  condition: "New" | "LikeNew" | "Good" | "Fair" | "Poor"
  price:     estimated resale value in USD as a number (e.g. 15.00)

Guidelines:
  - condition "New" means unopened/unused with tags; "LikeNew" means barely used; "Poor" means heavily worn or damaged
  - price should reflect realistic second-hand/resale market value, not retail
  - if the item type does not clearly fit a category, use "Misc"

Return ONLY the JSON object, no explanation or markdown.
"""

# ---------------------------------------------------------------------------
# Vision model
# ---------------------------------------------------------------------------

def _detect_media_type(image_bytes: bytes) -> str:
    if image_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"

def run_vision_model(image_bytes: bytes) -> tuple[str, str, float]:
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
    media_type = _detect_media_type(image_bytes)

    message = _anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_data}},
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }
        ],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    result = json.loads(text.strip())
    return result["category"], result["condition"], float(result["price"])


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    stored = load_stored()

    if stored is None:
        print("No token found — registering vision client...")
        token = acquire_token()
        save_token(token)
        print("Registered and token saved.")
    elif stored[1] != VISION_KEY:
        print("Vision key changed — re-registering...")
        token = acquire_token()
        save_token(token)
        print("Re-registered and token updated.")
    else:
        token = stored[0]
        print("Token loaded from file.")

    processing: list[dict] = []

    while True:
        if not processing:
            print("No images in progress — claiming batch...")
            claim_images(token)
            processing = fetch_processing_images(token)
            print(f"Claimed {len(processing)} images.")

        if not processing:
            print(f"No unprocessed images available. Waiting {POLL_INTERVAL}s...")
            time.sleep(POLL_INTERVAL)
            continue

        for row in processing:
            processing_id = row["id"]
            raw = row["image_bytes"]
            image_bytes = bytes.fromhex(raw) if isinstance(raw, str) else bytes(raw)

            print(f"Processing image {processing_id}...")
            category, condition, price = run_vision_model(image_bytes)

            submit_processed_image(token, processing_id, category, condition, price)
            print(f"Submitted image {processing_id}: {category}, {condition}, ${price:.2f}")

        processing = []
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
