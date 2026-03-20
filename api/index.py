"""
Vercel serverless function — FastAPI app serving Clean Air Compass API.
All /api/* routes are handled here.
"""

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from typing import Optional

app = FastAPI(title="City Clean Air Compass")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data lives in backend/data/ relative to project root
DATA_DIR = Path(__file__).parent.parent / "backend" / "data"

_cities_cache = None


def get_cities_list():
    global _cities_cache
    if _cities_cache is None:
        _cities_cache = load_json("cities.json")
    return _cities_cache


def load_json(filename: str):
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return None
    with open(filepath) as f:
        return json.load(f)


def load_json_file(filepath: Path):
    if not filepath.exists():
        return None
    with open(filepath) as f:
        return json.load(f)


@app.get("/api/cities")
def api_cities(search: Optional[str] = None, region: Optional[str] = None):
    cities = get_cities_list()
    result = cities
    if search:
        q = search.lower()
        result = [c for c in result if q in c["name"].lower() or q in c["iso"].lower()
                  or q in c.get("region", "").lower()]
    if region:
        result = [c for c in result if c.get("region") == region]
    return result


@app.get("/api/cities/{city_id}")
def api_city(city_id: str):
    detail = load_json_file(DATA_DIR / "cities" / f"{city_id}.json")
    if detail:
        for city in get_cities_list():
            if city["id"] == city_id:
                detail["summary"] = city
                break
        return detail
    for city in get_cities_list():
        if city["id"] == city_id:
            return {"id": city_id, "summary": city}
    return JSONResponse({"error": "City not found"}, status_code=404)


@app.get("/api/cities/{city_id}/smogstripes")
def api_smogstripes(city_id: str):
    data = load_json_file(DATA_DIR / "smogstripes" / f"{city_id}.json")
    if data:
        return data
    return JSONResponse({"error": "No smogstripes data"}, status_code=404)


@app.get("/api/cities/{city_id}/daily")
def api_daily(city_id: str):
    data = load_json_file(DATA_DIR / "daily" / f"{city_id}.json")
    if data:
        return data
    return JSONResponse({"error": "No daily data"}, status_code=404)


@app.get("/api/cities/{city_id}/health")
def api_health(city_id: str):
    data = load_json_file(DATA_DIR / "health" / f"{city_id}.json")
    if data:
        return data
    return JSONResponse({"error": "No health data"}, status_code=404)


@app.get("/api/cities/{city_id}/geojson")
def api_geojson(city_id: str):
    filepath = DATA_DIR / "geometry" / f"{city_id}.geojson"
    if not filepath.exists():
        return JSONResponse({"error": "No geometry data"}, status_code=404)
    with open(filepath) as f:
        content = f.read()
    return Response(
        content=content,
        media_type="application/geo+json",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/compare")
def api_compare(ids: str = Query(...)):
    city_ids = [c.strip() for c in ids.split(",")]
    cities = get_cities_list()
    summaries = [c for c in cities if c["id"] in city_ids]
    result = []
    for summary in summaries:
        detail = load_json_file(DATA_DIR / "cities" / f"{summary['id']}.json")
        entry = {"summary": summary}
        if detail:
            entry["scores"] = detail.get("scores", {})
            entry["raw_values"] = detail.get("raw_values", {})
            entry["policy_score"] = detail.get("policy_score")
        result.append(entry)
    return result


@app.get("/api/categories")
def api_categories():
    return load_json("categories.json")
