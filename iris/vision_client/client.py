#!/usr/local/bin/python3
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

def load_token() -> str | None:
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    return None

def save_token(token: str):
    TOKEN_FILE.write_text(token)

def acquire_token() -> str:
    url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/call/register_vision_client"
    resp = requests.post(url, headers={"Content-Type": "application/json"}, json=[VISION_KEY])
    resp.raise_for_status()
    return resp.headers["spacetime-identity-token"]


# ---------------------------------------------------------------------------
# Reducers
# ---------------------------------------------------------------------------

def claim_images(token: str):
    _call("claim_images", [], token)

def _enum(variant: str) -> dict:
    return {variant.lower(): []}

def submit_processed_image(token: str, processing_id: int, category: str, color: str, demographic: str):
    _call("submit_processed_image", [processing_id, _enum(category), _enum(color), _enum(demographic)], token)


# ---------------------------------------------------------------------------
# Table queries
# ---------------------------------------------------------------------------

def fetch_processing_images(token: str) -> list[dict]:
    return _sql("SELECT * FROM processing_image", token)


# ---------------------------------------------------------------------------
# Vision prompt — edit here
# ---------------------------------------------------------------------------

VISION_PROMPT = """\
Analyze this clothing item image and return a JSON object with exactly these fields:

{
  "category":    "<value>",
  "color":       "<value>",
  "demographic": "<value>"
}

Allowed values:
  category:    "Shirts" | "Pants"
  color:       "Red"    | "Blue"
  demographic: "Mens"   | "Womens"

If unsure, simply choose a value from the provided options, even if you do not believe the item to be clothing. This is a testing phase to ensure the pipeline works.

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

def run_vision_model(image_bytes: bytes) -> tuple[str, str, str]:
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
    return result["category"], result["color"], result["demographic"]


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    token = load_token()

    if token is None:
        print("No token found — registering vision client...")
        token = acquire_token()
        save_token(token)
        print("Registered and token saved.")
    else:
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
            category, color, demographic = run_vision_model(image_bytes)

            submit_processed_image(token, processing_id, category, color, demographic)
            print(f"Submitted image {processing_id}: {category}, {color}, {demographic}")

        processing = []
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
