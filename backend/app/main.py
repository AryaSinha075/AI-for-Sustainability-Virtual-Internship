import json
import os
import re
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(
    title="RESILIO API",
    description="AI-Powered Climate Resilience & Community Planning Platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LocationRequest(BaseModel):
    location: str


class PlanRequest(BaseModel):
    location: str
    risk: dict
    vulnerable_assets: list
    priorities: list


# -----------------------------------------------------------------------------
# Prototype location profiles
# These are demonstration inputs for the internship prototype, not live data.
# -----------------------------------------------------------------------------
LOCATION_PROFILES = {
    "bhubaneswar": {
        "rainfall": 78,
        "slope": 42,
        "temperature": 34,
        "cyclone_exposure": 0.72,
        "profile": "Coastal flood and cyclone exposure",
    },
    "kolkata": {
        "rainfall": 74,
        "slope": 8,
        "temperature": 35,
        "cyclone_exposure": 0.76,
        "profile": "Low-lying flood, heat and cyclone exposure",
    },
    "guwahati": {
        "rainfall": 88,
        "slope": 58,
        "temperature": 31,
        "cyclone_exposure": 0.28,
        "profile": "High rainfall, flood and terrain exposure",
    },
    "gangtok": {
        "rainfall": 82,
        "slope": 86,
        "temperature": 23,
        "cyclone_exposure": 0.08,
        "profile": "Steep-terrain and rainfall-triggered landslide exposure",
    },
    "patna": {
        "rainfall": 68,
        "slope": 10,
        "temperature": 38,
        "cyclone_exposure": 0.16,
        "profile": "Heat and low-lying flood exposure",
    },
    "ranchi": {
        "rainfall": 70,
        "slope": 46,
        "temperature": 32,
        "cyclone_exposure": 0.12,
        "profile": "Rainfall, terrain and heat exposure",
    },
    "mumbai": {
        "rainfall": 92,
        "slope": 18,
        "temperature": 33,
        "cyclone_exposure": 0.58,
        "profile": "Heavy-rainfall, flood and coastal exposure",
    },
    "delhi": {
        "rainfall": 42,
        "slope": 6,
        "temperature": 42,
        "cyclone_exposure": 0.04,
        "profile": "Extreme heat with seasonal rainfall exposure",
    },
}

DEFAULT_PROFILE = {
    "rainfall": 65,
    "slope": 35,
    "temperature": 32,
    "cyclone_exposure": 0.30,
    "profile": "General climate and infrastructure exposure",
}


# -----------------------------------------------------------------------------
# RAG knowledge base
# Small, focused prototype corpus. Retrieval selects only relevant passages
# before sending context to IBM Granite.
# -----------------------------------------------------------------------------
RAG_DOCUMENTS = [
    {
        "title": "Flood resilience planning",
        "text": (
            "Flood resilience planning should consider drainage capacity, flood-prone "
            "areas, protection of essential services, safe evacuation access, water-flow "
            "monitoring, and preparedness for vulnerable communities. Nature-based and "
            "infrastructure measures can be combined where locally feasible."
        ),
        "hazards": ["flood", "rainfall", "cyclone"],
    },
    {
        "title": "Landslide and slope resilience",
        "text": (
            "Rainfall-triggered landslide planning should consider slope instability, "
            "terrain-sensitive roads, drainage on slopes, monitoring of vulnerable zones, "
            "vegetation and soil protection, and stabilization of critical corridors. "
            "Interventions should be reviewed by appropriate technical authorities."
        ),
        "hazards": ["landslide", "rainfall", "slope", "terrain"],
    },
    {
        "title": "Heat resilience",
        "text": (
            "Heat resilience can include heat-risk communication, identification of "
            "heat-exposed communities, shaded public spaces, cooling access, continuity "
            "of essential services, and measures that reduce heat exposure for vulnerable "
            "groups. Local heat-action plans should guide implementation."
        ),
        "hazards": ["heat", "heatwave", "temperature"],
    },
    {
        "title": "Cyclone resilience and emergency continuity",
        "text": (
            "Cyclone preparedness should consider early communication, evacuation routes, "
            "shelter access, continuity of essential services, protection of critical "
            "infrastructure, and coordination across responsible agencies. Plans should "
            "account for uncertainty and be adapted to local conditions."
        ),
        "hazards": ["cyclone", "coastal", "wind", "storm"],
    },
    {
        "title": "Community-centred resilience planning",
        "text": (
            "Resilience decisions should connect hazard exposure with people, critical "
            "infrastructure, essential services and environmental assets. A practical "
            "prioritization approach considers severity, affected population, asset "
            "criticality, feasibility and available resources. Human decision-makers "
            "should review AI-generated recommendations before implementation."
        ),
        "hazards": ["community", "infrastructure", "services", "planning", "priority"],
    },
]


WATSONX_URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_APIKEY = os.getenv("WATSONX_APIKEY", "").strip()
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "").strip()
WATSONX_MODEL_ID = os.getenv("WATSONX_MODEL_ID", "ibm/granite-4-h-small").strip()


def get_profile(location: str):
    normalized = location.lower().strip()

    for key, profile in LOCATION_PROFILES.items():
        if key in normalized:
            return profile.copy(), key

    return DEFAULT_PROFILE.copy(), "generic"


def clamp(value, minimum=0, maximum=100):
    return max(minimum, min(maximum, value))


def calculate_risk(rainfall, slope, temperature, cyclone_exposure):
    flood = clamp(round((rainfall * 0.60) + 25))
    landslide = clamp(round((rainfall * 0.45) + (slope * 0.55)))
    heat = clamp(round((temperature - 20) * 7))
    cyclone = clamp(round(cyclone_exposure * 100))

    overall = round(
        (flood * 0.30)
        + (landslide * 0.20)
        + (heat * 0.20)
        + (cyclone * 0.30)
    )

    return {
        "flood": flood,
        "landslide": landslide,
        "heat": heat,
        "cyclone": cyclone,
        "overall": overall,
    }


def build_assets(risk):
    return [
        {
            "name": "Low-lying residential areas",
            "type": "Community",
            "risk": risk["flood"],
        },
        {
            "name": "Major road corridors",
            "type": "Infrastructure",
            "risk": max(risk["flood"], risk["landslide"]),
        },
        {
            "name": "Essential public services",
            "type": "Service",
            "risk": max(risk["heat"], risk["cyclone"]),
        },
        {
            "name": "Environmentally sensitive zones",
            "type": "Environment",
            "risk": max(risk["landslide"], risk["flood"]),
        },
    ]


def build_priorities(risk):
    candidates = [
        {
            "score": risk["flood"],
            "action": "Improve drainage and flood preparedness",
            "reason": "Flood exposure indicates potential disruption to vulnerable communities and low-lying areas.",
        },
        {
            "score": risk["landslide"],
            "action": "Protect vulnerable terrain and road connectivity",
            "reason": "Rainfall and terrain conditions may increase instability around important corridors.",
        },
        {
            "score": risk["heat"],
            "action": "Prepare heat-response measures",
            "reason": "Elevated temperature exposure can affect communities, outdoor activity and essential services.",
        },
        {
            "score": risk["cyclone"],
            "action": "Strengthen cyclone preparedness",
            "reason": "Cyclone exposure increases the importance of emergency communication, evacuation access and service continuity.",
        },
    ]

    candidates.sort(key=lambda item: item["score"], reverse=True)

    return [
        {
            "priority": index,
            "action": item["action"],
            "reason": item["reason"],
        }
        for index, item in enumerate(candidates[:4], start=1)
    ]


def retrieve_rag_documents(risk: dict, priorities: list, top_k: int = 3):
    hazard_scores = {
        "flood": risk.get("flood", 0),
        "landslide": risk.get("landslide", 0),
        "heat": risk.get("heat", 0),
        "cyclone": risk.get("cyclone", 0),
    }

    priority_text = " ".join(
        f"{item.get('action', '')} {item.get('reason', '')}" for item in priorities
    ).lower()

    ranked = []
    for document in RAG_DOCUMENTS:
        score = 0
        for hazard, value in hazard_scores.items():
            if value >= 60 and hazard in document["hazards"]:
                score += value

        for keyword in document["hazards"]:
            if keyword in priority_text:
                score += 15

        if document["title"] == "Community-centred resilience planning":
            score += 20

        ranked.append((score, document))

    ranked.sort(key=lambda item: item[0], reverse=True)
    selected = [item[1] for item in ranked[:top_k]]

    return selected


def get_ibm_access_token():
    if not WATSONX_APIKEY:
        raise RuntimeError("WATSONX_APIKEY is not configured.")

    response = requests.post(
        "https://iam.cloud.ibm.com/oidc/token",
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": WATSONX_APIKEY,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )

    response.raise_for_status()
    return response.json()["access_token"]


def extract_model_text(payload: dict) -> str:
    choices = payload.get("choices") or []
    if choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            return "".join(parts)

        text = choices[0].get("text")
        if isinstance(text, str):
            return text

    results = payload.get("results") or []
    if results and isinstance(results[0], dict):
        text = results[0].get("generated_text") or results[0].get("text")
        if isinstance(text, str):
            return text

    return ""


def clean_json_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def fallback_plan(location: str, risk: dict):
    actions = []

    if risk.get("flood", 0) >= 60:
        actions.append(
            {
                "title": "Strengthen flood preparedness",
                "action": "Prioritize drainage improvement, water-flow monitoring and flood response planning.",
                "reason": "Flood exposure is elevated in the current assessment.",
            }
        )

    if risk.get("landslide", 0) >= 60:
        actions.append(
            {
                "title": "Protect vulnerable terrain",
                "action": "Monitor slope-sensitive areas and prioritize stabilization around important road corridors.",
                "reason": "Rainfall and terrain conditions indicate landslide exposure.",
            }
        )

    if risk.get("heat", 0) >= 60:
        actions.append(
            {
                "title": "Prepare heat-response measures",
                "action": "Identify heat-exposed communities and strengthen access to shaded and cooling spaces.",
                "reason": "Temperature exposure may affect community safety and essential services.",
            }
        )

    if risk.get("cyclone", 0) >= 60:
        actions.append(
            {
                "title": "Strengthen cyclone preparedness",
                "action": "Review emergency communication, evacuation access and protection of critical services.",
                "reason": "Cyclone exposure is significant in the current assessment.",
            }
        )

    if not actions:
        actions.append(
            {
                "title": "Continue resilience monitoring",
                "action": "Maintain monitoring of climate indicators and critical infrastructure.",
                "reason": "Current prototype risk levels do not indicate a dominant high-risk hazard.",
            }
        )

    return {
        "location": location,
        "overall_risk": risk.get("overall", 0),
        "planning_principle": "Prioritize interventions where hazard exposure, community vulnerability and infrastructure criticality overlap.",
        "recommended_actions": actions,
        "human_review_required": True,
        "ai_note": "Fallback prototype planning layer. IBM Granite was not called for this request.",
        "ai_provider": "Prototype fallback",
        "rag_used": False,
    }


def generate_granite_plan(location: str, risk: dict, assets: list, priorities: list):
    if not WATSONX_APIKEY or not WATSONX_PROJECT_ID:
        return fallback_plan(location, risk)

    selected_docs = retrieve_rag_documents(risk, priorities)
    documents = [
        {
            "title": document["title"],
            "text": document["text"],
            "source": "RESILIO RAG knowledge base",
        }
        for document in selected_docs
    ]

    prompt = f"""
You are the AI resilience planning layer inside RESILIO, a climate-resilience
and community-planning decision-support system.

Use ONLY the supplied assessment and retrieved resilience documents. Do not
invent live weather, official warnings, disaster probabilities, or numerical
measurements.

Create a practical resilience plan for the selected area.

LOCATION:
{location}

RISK SCORES:
{json.dumps(risk, indent=2)}

VULNERABLE ASSETS:
{json.dumps(assets, indent=2)}

CURRENT PRIORITIES:
{json.dumps(priorities, indent=2)}

Return valid JSON with exactly these fields:
{{
  "planning_principle": "one concise sentence",
  "recommended_actions": [
    {{
      "title": "action title",
      "action": "specific practical recommendation",
      "reason": "why this recommendation follows from the assessment"
    }}
  ],
  "human_review_required": true,
  "ai_note": "one sentence explaining that this is decision support and needs human review"
}}

Provide 3 to 5 actions. Prioritize the most important risk drivers first.
""".strip()

    token = get_ibm_access_token()

    response = requests.post(
        f"{WATSONX_URL.rstrip('/')}/ml/v1/text/chat?version=2025-10-25",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        json={
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a careful climate resilience planning assistant. "
                        "Use retrieved documents as supporting context and keep "
                        "recommendations explainable and suitable for human review."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "chat_template_kwargs": {"documents": documents},
            "project_id": WATSONX_PROJECT_ID,
            "model_id": WATSONX_MODEL_ID,
            "max_completion_tokens": 1200,
            "temperature": 0,
            "response_format": {"type": "json_object"},
        },
        timeout=90,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"IBM Granite request failed ({response.status_code}): {response.text[:1000]}"
        )

    raw_text = extract_model_text(response.json())
    if not raw_text:
        raise RuntimeError("IBM Granite returned an empty response.")

    parsed = json.loads(clean_json_text(raw_text))

    recommended_actions = parsed.get("recommended_actions")
    if not isinstance(recommended_actions, list) or not recommended_actions:
        raise RuntimeError("IBM Granite returned no recommended actions.")

    return {
        "location": location,
        "overall_risk": risk.get("overall", 0),
        "planning_principle": parsed.get(
            "planning_principle",
            "Prioritize interventions where hazard exposure, community vulnerability and infrastructure criticality overlap.",
        ),
        "recommended_actions": recommended_actions,
        "human_review_required": True,
        "ai_note": parsed.get(
            "ai_note",
            "IBM Granite recommendations are decision-support suggestions and require human review.",
        ),
        "ai_provider": "IBM Granite via watsonx.ai",
        "rag_used": True,
        "rag_sources": [document["title"] for document in selected_docs],
        "model_id": WATSONX_MODEL_ID,
    }


@app.get("/")
def root():
    return {"service": "RESILIO backend", "status": "running"}


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "RESILIO backend",
        "granite_configured": bool(WATSONX_APIKEY and WATSONX_PROJECT_ID),
        "rag_enabled": True,
        "model": WATSONX_MODEL_ID,
    }


@app.post("/analyze")
def analyze_location(request: LocationRequest):
    climate_data, matched_profile = get_profile(request.location)

    risk = calculate_risk(
        climate_data["rainfall"],
        climate_data["slope"],
        climate_data["temperature"],
        climate_data["cyclone_exposure"],
    )

    profile_description = climate_data.pop("profile")

    return {
        "location": request.location,
        "matched_profile": matched_profile,
        "profile_description": profile_description,
        "climate_data": climate_data,
        "risk": risk,
        "vulnerable_assets": build_assets(risk),
        "priorities": build_priorities(risk),
        "prototype_note": "Values are demonstration inputs used to illustrate the RESILIO decision-support workflow. They are not live measurements or official forecasts.",
    }


@app.post("/generate-plan")
def generate_plan(request: PlanRequest):
    try:
        return generate_granite_plan(
            request.location,
            request.risk,
            request.vulnerable_assets,
            request.priorities,
        )
    except Exception as error:
        print(f"IBM Granite error: {error}")
        fallback = fallback_plan(request.location, request.risk)
        fallback["ai_note"] = (
            "IBM Granite was configured but could not be reached for this request. "
            "RESILIO returned the prototype fallback plan instead."
        )
        fallback["ai_provider"] = "Prototype fallback after Granite error"
        fallback["granite_error"] = str(error)
        return fallback
