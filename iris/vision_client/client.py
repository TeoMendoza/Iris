#!/usr/bin/env python3
import os
import time
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SPACETIME_URL = os.environ["SPACETIME_URL"]
DB_NAME = os.environ["DB_NAME"]
VISION_KEY = os.environ["VISION_KEY"]
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

TOKEN_FILE = Path(".vision_token")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def _call(reducer: str, args: list, token: str) -> requests.Response:
    url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/call/{reducer}"
    resp = requests.post(url, headers=_headers(token), json=args)
    resp.raise_for_status()
    return resp

def _sql(query: str, token: str) -> list[dict]:
    url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/sql"
    resp = requests.post(url, headers=_headers(token), json={"query": query})
    resp.raise_for_status()
    return resp.json()


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
    # First call with no auth — SpacetimeDB creates a new identity and returns a token.
    # The token is in the response header: Authorization: Bearer <token>
    url = f"{SPACETIME_URL}/v1/database/{DB_NAME}/call/register_vision_client"
    resp = requests.post(url, headers={"Content-Type": "application/json"}, json=[VISION_KEY])
    resp.raise_for_status()
    token = resp.headers["Authorization"].removeprefix("Bearer ").strip()
    return token


# ---------------------------------------------------------------------------
# Reducers
# ---------------------------------------------------------------------------

def claim_images(token: str):
    _call("claim_images", [], token)

def submit_processed_image(token: str, processing_id: int, category: str, color: str, demographic: str):
    _call("submit_processed_image", [processing_id, {"tag": category}, {"tag": color}, {"tag": demographic}], token)


# ---------------------------------------------------------------------------
# Table queries
# ---------------------------------------------------------------------------

def fetch_processing_images(token: str) -> list[dict]:
    return _sql("SELECT * FROM processing_image", token)


# ---------------------------------------------------------------------------
# Vision model — implement this
# ---------------------------------------------------------------------------

def run_vision_model(image_bytes: bytes) -> tuple[str, str, str]:
    # TODO: run your vision model on image_bytes
    # Return (category, color, demographic) as strings matching the server enums:
    #   category:    "Shirts" | "Pants"
    #   color:       "Red"    | "Blue"
    #   demographic: "Mens"   | "Womens"
    raise NotImplementedError("Vision model not implemented")


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
            image_bytes = bytes(row["image_bytes"])

            print(f"Processing image {processing_id}...")
            category, color, demographic = run_vision_model(image_bytes)

            submit_processed_image(token, processing_id, category, color, demographic)
            print(f"Submitted image {processing_id}: {category}, {color}, {demographic}")

        processing = []
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
