from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


COMMONS_API = "https://commons.wikimedia.org/w/api.php"


def _absolute_url(value: str) -> str:
    return "https:" + value if value.startswith("//") else value


def _request(params: dict[str, str]) -> dict[str, Any] | None:
    request = Request(
        f"{COMMONS_API}?{urlencode(params)}",
        headers={"User-Agent": "CAR-Catcher-Local/1.0"},
    )
    try:
        with urlopen(request, timeout=7) as response:
            return json.load(response)
    except Exception:
        return None


def _first_image(payload: dict[str, Any] | None, query: str) -> dict[str, str] | None:
    if not payload:
        return None
    pages = payload.get("query", {}).get("pages", [])
    pages.sort(key=lambda page: page.get("index", 9999))
    for page in pages:
        image_info: list[dict[str, Any]] = page.get("imageinfo", [])
        if not image_info:
            continue
        info = image_info[0]
        if not str(info.get("mime", "")).startswith("image/"):
            continue
        image_url = info.get("thumburl") or info.get("url")
        source_url = info.get("descriptionurl")
        if image_url and source_url:
            return {
                "url": _absolute_url(str(image_url)),
                "sourceUrl": _absolute_url(str(source_url)),
                "title": str(page.get("title", query)).removeprefix("File:"),
            }
    return None


def _search_commons(query: str) -> dict[str, str] | None:
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": "8",
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": "900",
    }
    return _first_image(_request(params), query)


def _search_commons_category(query: str) -> dict[str, str] | None:
    category_search = _request(
        {
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "list": "search",
            "srsearch": query,
            "srnamespace": "14",
            "srlimit": "3",
        }
    )
    categories = (category_search or {}).get("query", {}).get("search", [])
    for category in categories:
        title = str(category.get("title", ""))
        if not title.startswith("Category:"):
            continue
        payload = _request(
            {
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "generator": "categorymembers",
                "gcmtitle": title,
                "gcmtype": "file",
                "gcmlimit": "8",
                "prop": "imageinfo",
                "iiprop": "url|mime",
                "iiurlwidth": "900",
            }
        )
        result = _first_image(payload, query)
        if result:
            return result
    return None


@lru_cache(maxsize=128)
def lookup_vehicle_image(product_name: str) -> dict[str, str] | None:
    """Find a Top-1 reference photo, relaxing year/body words if necessary."""
    search_aliases = {
        "Maybach Landaulet": "Maybach 62 S Landaulet",
    }
    without_year = re.sub(r"\s+(19|20)\d{2}$", "", product_name).strip()
    model_only = re.sub(
        r"\s+(Sedan|Hatchback|Convertible|Coupe|Wagon|Minivan)$",
        "",
        without_year,
        flags=re.IGNORECASE,
    ).strip()
    alias = next(
        (
            replacement
            for prefix, replacement in search_aliases.items()
            if product_name.startswith(prefix)
        ),
        "",
    )
    queries = list(
        dict.fromkeys(
            query for query in (alias, product_name, without_year, model_only) if query
        )
    )
    for query in queries:
        result = _search_commons(query)
        if result:
            return result
    for query in reversed(queries):
        result = _search_commons_category(query)
        if result:
            return result
    return None
