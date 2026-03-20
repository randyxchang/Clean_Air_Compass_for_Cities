from fastapi import FastAPI, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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

DATA_DIR = Path(__file__).parent / "data"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

# Load cities into memory at startup
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
    """Return all cities with summary data. Optional search and region filters."""
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
    """Return detailed profile for a single city."""
    detail = load_json_file(DATA_DIR / "cities" / f"{city_id}.json")
    if detail:
        # Merge with summary data
        for city in get_cities_list():
            if city["id"] == city_id:
                detail["summary"] = city
                break
        return detail
    # Fallback to summary only
    for city in get_cities_list():
        if city["id"] == city_id:
            return {"id": city_id, "summary": city}
    return JSONResponse({"error": "City not found"}, status_code=404)


@app.get("/api/cities/{city_id}/smogstripes")
def api_smogstripes(city_id: str):
    """Return smogstripes yearly PM2.5 data for a city."""
    data = load_json_file(DATA_DIR / "smogstripes" / f"{city_id}.json")
    if data:
        return data
    return JSONResponse({"error": "No smogstripes data"}, status_code=404)


@app.get("/api/cities/{city_id}/daily")
def api_daily(city_id: str):
    """Return aggregated daily air quality data for a city."""
    data = load_json_file(DATA_DIR / "daily" / f"{city_id}.json")
    if data:
        return data
    return JSONResponse({"error": "No daily data"}, status_code=404)


@app.get("/api/cities/{city_id}/health")
def api_health(city_id: str):
    """Return health impact and source breakdown for a city."""
    data = load_json_file(DATA_DIR / "health" / f"{city_id}.json")
    if data:
        return data
    return JSONResponse({"error": "No health data"}, status_code=404)


@app.get("/api/cities/{city_id}/geojson")
def api_geojson(city_id: str):
    """Return GeoJSON boundaries for a city."""
    filepath = DATA_DIR / "geometry" / f"{city_id}.geojson"
    if not filepath.exists():
        return JSONResponse({"error": "No geometry data"}, status_code=404)
    return FileResponse(
        filepath,
        media_type="application/geo+json",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/compare")
def api_compare(ids: str = Query(...)):
    """Compare multiple cities. Pass comma-separated city IDs."""
    city_ids = [c.strip() for c in ids.split(",")]
    cities = get_cities_list()
    summaries = [c for c in cities if c["id"] in city_ids]

    # Enrich with detail data
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
    """Return policy/action categories."""
    return load_json("categories.json")


# Serve frontend static files (from public/ for Vercel compat)
PUBLIC_DIR = Path(__file__).parent.parent / "public"
app.mount("/css", StaticFiles(directory=PUBLIC_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=PUBLIC_DIR / "js"), name="js")
if (PUBLIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=PUBLIC_DIR / "images"), name="images")


@app.get("/")
def index():
    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/favicon.ico")
def favicon():
    return FileResponse(PUBLIC_DIR / "favicon.ico", media_type="image/x-icon")
