import Login from "./Login";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Fix Leaflet marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_LOCATION = {
  lat: 20.2961,
  lon: 85.8245,
  displayName: "Bhubaneswar",
};

const LOCATION_PRESETS = {
  bhubaneswar: {
    lat: 20.2961,
    lon: 85.8245,
    displayName: "Bhubaneswar, Odisha",
  },
  kolkata: {
    lat: 22.5726,
    lon: 88.3639,
    displayName: "Kolkata, West Bengal",
  },
  guwahati: {
    lat: 26.1445,
    lon: 91.7362,
    displayName: "Guwahati, Assam",
  },
  gangtok: {
    lat: 27.3389,
    lon: 88.6065,
    displayName: "Gangtok, Sikkim",
  },
  patna: {
    lat: 25.5941,
    lon: 85.1376,
    displayName: "Patna, Bihar",
  },
  ranchi: {
    lat: 23.3441,
    lon: 85.3096,
    displayName: "Ranchi, Jharkhand",
  },
  mumbai: {
    lat: 19.076,
    lon: 72.8777,
    displayName: "Mumbai, Maharashtra",
  },
  delhi: {
    lat: 28.6139,
    lon: 77.209,
    displayName: "New Delhi",
  },
};

function MapRecenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lon], 11, {
        duration: 1.4,
      });
    }
  }, [map, position]);

  return null;
}

function getRiskLevel(value) {
  if (value >= 70) return "High";
  if (value >= 40) return "Moderate";
  return "Low";
}

function getRiskClass(value) {
  if (value >= 70) return "risk-high";
  if (value >= 40) return "risk-medium";
  return "risk-low";
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATION);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;

      setCursor({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const mapPosition = useMemo(
    () => [selectedLocation.lat, selectedLocation.lon],
    [selectedLocation]
  );

  const risk = data?.risk;

  const analyzeLocation = async () => {
    const trimmedLocation = location.trim();

    if (!trimmedLocation) {
      setError("Enter a location first.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: trimmedLocation,
        }),
      });

      if (!response.ok) {
        throw new Error("Backend analysis failed.");
      }

      const result = await response.json();

      setData(result);
      setPlan(null);
      setScenarioResult(null);

      await findLocation(trimmedLocation);
    } catch (err) {
      console.error(err);
      setError(
        "Could not analyze this location. Make sure the RESILIO backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const findLocation = async (query) => {
    const normalized = query.toLowerCase().trim();

    const presetKey = Object.keys(LOCATION_PRESETS).find((key) =>
      normalized.includes(key)
    );

    if (presetKey) {
      setSelectedLocation(LOCATION_PRESETS[presetKey]);
      return;
    }

    setLocationLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          query
        )}`
      );

      if (!response.ok) {
        throw new Error("Location search failed.");
      }

      const results = await response.json();

      if (results.length > 0) {
        setSelectedLocation({
          lat: Number(results[0].lat),
          lon: Number(results[0].lon),
          displayName: results[0].display_name,
        });
      }
    } catch (err) {
      console.error("Geocoding error:", err);

      // Keep the previous map position if geocoding fails.
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    analyzeLocation();
  };

  const generateResiliencePlan = async () => {
    if (!data?.risk) {
      setError("Assess an area before generating a resilience plan.");
      return;
    }

    setError("");
    setPlanLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/ai-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: data.location,
          risk: data.risk,
          vulnerable_assets: data.vulnerable_assets || [],
          priorities: data.priorities || [],
        }),
      });

      if (!response.ok) {
        throw new Error("Planner request failed.");
      }

      const result = await response.json();
      setPlan(result);
    } catch (err) {
      console.error(err);
      setError("Could not generate the resilience plan. Check that the RESILIO backend is running.");
    } finally {
      setPlanLoading(false);
    }
  };

  const runRainfallScenario = () => {
    if (!data?.climate_data || !data?.risk) {
      setError("Assess an area before running a scenario.");
      return;
    }

    setError("");

    const rainfall = Number(data.climate_data.rainfall || 0);
    const slope = Number(data.climate_data.slope || 0);
    const temperature = Number(data.climate_data.temperature || 0);
    const cycloneExposure = Number(data.climate_data.cyclone_exposure || 0);

    const scenarioRainfall = rainfall * 1.2;
    const flood = Math.min(100, Math.round((scenarioRainfall * 0.6) + 25));
    const landslide = Math.min(
      100,
      Math.round((scenarioRainfall * 0.45) + (slope * 0.55))
    );
    const heat = Math.min(100, Math.round((temperature - 20) * 7));
    const cyclone = Math.min(100, Math.round(cycloneExposure * 100));

    const overall = Math.round(
      (flood * 0.30) +
      (landslide * 0.20) +
      (heat * 0.20) +
      (cyclone * 0.30)
    );

    setScenarioResult({
      rainfallIncrease: 20,
      current: data.risk,
      scenario: { flood, landslide, heat, cyclone, overall },
    });
  };

  const overallRisk = risk?.overall ?? 0;

  const hazardData = risk
    ? [
        {
          name: "Flood",
          value: risk.flood,
          icon: "≈",
          description: "Water accumulation and low-lying exposure",
        },
        {
          name: "Landslide",
          value: risk.landslide,
          icon: "⌁",
          description: "Rainfall and terrain-related instability",
        },
        {
          name: "Heatwave",
          value: risk.heat,
          icon: "☼",
          description: "Extreme temperature exposure",
        },
        {
          name: "Cyclone",
          value: risk.cyclone,
          icon: "◌",
          description: "Cyclonic exposure and disruption",
        },
      ]
    : [];

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div
      className="app"
      style={{
        "--cursor-x": `${cursor.x}%`,
        "--cursor-y": `${cursor.y}%`,
      }}
    >
      <div className="ambient ambient-one"></div>
      <div className="ambient ambient-two"></div>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <div className="brand-name">RESILIO</div>
            <div className="brand-subtitle">Climate resilience intelligence</div>
          </div>
        </div>

        <div className="nav-status">
          <span className="status-dot"></span>
          Prototype system
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-background"></div>
        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="eyebrow">
            <span></span>
            AI-POWERED COMMUNITY PLANNING
          </div>

          <h1>
            Build resilience
            <br />
            <em>before disruption.</em>
          </h1>

          <p className="hero-description">
            RESILIO brings climate risk, vulnerable communities and critical
            infrastructure together to help planners understand risk,
            prioritize action and prepare smarter.
          </p>

          <form className="location-search" onSubmit={handleSearch}>
            <div className="search-icon">⌕</div>

            <input
              type="text"
              placeholder="Enter a city, district or community..."
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Analyzing..." : "Assess area"}
              <span>→</span>
            </button>
          </form>

          {error && <div className="search-error">{error}</div>}

          <div className="quick-locations">
            <span>Try:</span>

            <button
              type="button"
              onClick={() => setLocation("Bhubaneswar")}
            >
              Bhubaneswar
            </button>

            <button
              type="button"
              onClick={() => setLocation("Guwahati")}
            >
              Guwahati
            </button>

            <button
              type="button"
              onClick={() => setLocation("Kolkata")}
            >
              Kolkata
            </button>

            <button
              type="button"
              onClick={() => setLocation("Gangtok")}
            >
              Gangtok
            </button>
          </div>
        </div>

        <div className="hero-map-card">
          <div className="map-card-label">
            <span className="live-dot"></span>
            RESILIENCE MAP
          </div>

          <div className="hero-map">
            <MapContainer
              center={mapPosition}
              zoom={10}
              scrollWheelZoom={false}
              zoomControl={false}
              attributionControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              <MapRecenter position={selectedLocation} />

              <Circle
                center={mapPosition}
                radius={9000}
                pathOptions={{
                  color: "#c65d45",
                  fillColor: "#c65d45",
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              />

              <Circle
                center={mapPosition}
                radius={4500}
                pathOptions={{
                  color: "#d99a54",
                  fillColor: "#d99a54",
                  fillOpacity: 0.12,
                  weight: 1.5,
                }}
              />

              <Marker position={mapPosition}>
                <Popup>
                  <strong>{selectedLocation.displayName}</strong>
                  <br />
                  RESILIO assessment area
                </Popup>
              </Marker>
            </MapContainer>
          </div>

          <div className="map-card-footer">
            <div>
              <span>Selected area</span>
              <strong>
                {locationLoading
                  ? "Locating..."
                  : selectedLocation.displayName}
              </strong>
            </div>

            <div className="map-coordinates">
              {selectedLocation.lat.toFixed(3)}° N
              <br />
              {selectedLocation.lon.toFixed(3)}° E
            </div>
          </div>
        </div>

        <div className="hero-bottom-note">
          Assess <span>→</span> Understand <span>→</span> Prioritize{" "}
          <span>→</span> Plan
        </div>
      </section>

      {/* EMPTY STATE */}
      {!data && (
        <section className="empty-state-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">HOW RESILIO WORKS</span>

              <h2>
                From climate signals
                <br />
                to practical action.
              </h2>
            </div>

            <p>
              Select an area above and RESILIO will combine climate indicators,
              vulnerability and infrastructure exposure into a structured
              resilience assessment.
            </p>
          </div>

          <div className="process-grid">
            <div className="process-card">
              <span className="process-number">01</span>
              <div className="process-icon">⌖</div>
              <h3>Assess</h3>
              <p>
                Examine climate and environmental indicators for the selected
                area.
              </p>
            </div>

            <div className="process-card">
              <span className="process-number">02</span>
              <div className="process-icon">◉</div>
              <h3>Understand</h3>
              <p>
                Identify communities, infrastructure and services exposed to
                different hazards.
              </p>
            </div>

            <div className="process-card">
              <span className="process-number">03</span>
              <div className="process-icon">↗</div>
              <h3>Prioritize</h3>
              <p>
                Compare severity, affected population, criticality and
                feasibility.
              </p>
            </div>

            <div className="process-card">
              <span className="process-number">04</span>
              <div className="process-icon">✦</div>
              <h3>Plan</h3>
              <p>
                Generate explainable resilience actions that planners can
                review and adapt.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* RESULTS */}
      {data && (
        <main className="dashboard">
          {/* LOCATION HEADER */}
          <section className="location-header">
            <div>
              <span className="section-kicker">ASSESSMENT COMPLETE</span>

              <h2>{data.location}</h2>

              <p>
                Climate resilience assessment based on the current RESILIO
                prototype risk model.
              </p>
            </div>

            <div className="assessment-badge">
              <span className="status-dot"></span>
              Analysis ready
            </div>
          </section>

          {/* OVERALL RISK */}
          <section className="risk-overview">
            <div className="risk-main-card">
              <div className="risk-card-top">
                <div>
                  <span className="section-kicker">OVERALL RESILIENCE RISK</span>
                  <h3>Current exposure overview</h3>
                </div>

                <span className={`risk-pill ${getRiskClass(overallRisk)}`}>
                  {getRiskLevel(overallRisk)} risk
                </span>
              </div>

              <div className="risk-score-area">
                <div
                  className="risk-ring"
                  style={{
                    "--risk-progress": `${overallRisk * 3.6}deg`,
                  }}
                >
                  <div className="risk-ring-inner">
                    <strong>{overallRisk}</strong>
                    <span>/ 100</span>
                  </div>
                </div>

                <div className="risk-explanation">
                  <h4>
                    {overallRisk >= 70
                      ? "Multiple hazards require attention."
                      : overallRisk >= 40
                      ? "Several risk factors need monitoring."
                      : "Current exposure appears relatively limited."}
                  </h4>

                  <p>
                    The overall score combines flood, landslide, heat and
                    cyclone exposure indicators. It is intended for planning
                    support, not as a certified forecast.
                  </p>

                  <div className="risk-scale">
                    <span>LOW</span>
                    <span>MODERATE</span>
                    <span>HIGH</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="risk-side-card">
              <span className="section-kicker">ASSESSMENT LOGIC</span>

              <div className="logic-item">
                <span>01</span>
                <div>
                  <strong>Climate signals</strong>
                  <p>Rainfall, temperature and exposure indicators</p>
                </div>
              </div>

              <div className="logic-item">
                <span>02</span>
                <div>
                  <strong>Hazard analysis</strong>
                  <p>Four major climate-related hazards</p>
                </div>
              </div>

              <div className="logic-item">
                <span>03</span>
                <div>
                  <strong>Priority generation</strong>
                  <p>Risk translated into practical actions</p>
                </div>
              </div>
            </div>
          </section>

          {/* HAZARDS */}
          <section className="dashboard-section">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">HAZARD BREAKDOWN</span>
                <h2>Where is the exposure coming from?</h2>
              </div>

              <p>
                Understanding individual hazards helps planners focus resources
                where they matter most.
              </p>
            </div>

            <div className="hazard-grid">
              {hazardData.map((hazard) => (
                <div className="hazard-card" key={hazard.name}>
                  <div className="hazard-top">
                    <div className="hazard-icon">{hazard.icon}</div>

                    <span className={`risk-pill ${getRiskClass(hazard.value)}`}>
                      {getRiskLevel(hazard.value)}
                    </span>
                  </div>

                  <h3>{hazard.name}</h3>

                  <p>{hazard.description}</p>

                  <div className="hazard-score">
                    <strong>{hazard.value}</strong>
                    <span>/100</span>
                  </div>

                  <div className="progress-track">
                    <div
                      className={`progress-fill ${getRiskClass(hazard.value)}`}
                      style={{ width: `${hazard.value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* MAP */}
          <section className="dashboard-section map-section">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">SPATIAL VIEW</span>
                <h2>See the assessment geographically.</h2>
              </div>

              <p>
                The map provides a visual planning layer for the selected
                community.
              </p>
            </div>

            <div className="large-map-card">
              <MapContainer
                center={mapPosition}
                zoom={11}
                scrollWheelZoom={true}
                zoomControl={true}
                attributionControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />

                <MapRecenter position={selectedLocation} />

                <Circle
                  center={mapPosition}
                  radius={12000}
                  pathOptions={{
                    color: "#c65d45",
                    fillColor: "#c65d45",
                    fillOpacity: 0.08,
                    weight: 2,
                  }}
                />

                <Circle
                  center={mapPosition}
                  radius={6000}
                  pathOptions={{
                    color: "#d99a54",
                    fillColor: "#d99a54",
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
                />

                <Circle
                  center={mapPosition}
                  radius={2500}
                  pathOptions={{
                    color: "#315f55",
                    fillColor: "#315f55",
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
                />

                <Marker position={mapPosition}>
                  <Popup>
                    <strong>{selectedLocation.displayName}</strong>
                    <br />
                    RESILIO assessment location
                  </Popup>
                </Marker>
              </MapContainer>

              <div className="map-overlay-legend">
                <div className="legend-title">RISK ZONES</div>

                <div>
                  <span className="legend-dot high"></span>
                  High exposure
                </div>

                <div>
                  <span className="legend-dot medium"></span>
                  Moderate exposure
                </div>

                <div>
                  <span className="legend-dot low"></span>
                  Lower exposure
                </div>
              </div>
            </div>
          </section>

          {/* VULNERABLE ASSETS */}
          <section className="dashboard-section">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">VULNERABILITY</span>
                <h2>What could be affected?</h2>
              </div>

              <p>
                Risk becomes more meaningful when connected to people,
                infrastructure and essential services.
              </p>
            </div>

            <div className="asset-grid">
              {data.vulnerable_assets?.map((asset, index) => (
                <div className="asset-card" key={`${asset.name}-${index}`}>
                  <div className="asset-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="asset-content">
                    <span>{asset.type}</span>
                    <h3>{asset.name}</h3>

                    <div className="asset-risk">
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${getRiskClass(asset.risk)}`}
                          style={{ width: `${asset.risk}%` }}
                        ></div>
                      </div>

                      <strong>{asset.risk}/100</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PRIORITIES */}
          <section className="dashboard-section">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">PRIORITY ACTIONS</span>
                <h2>Where should planning start?</h2>
              </div>

              <p>
                RESILIO turns the assessment into a prioritized set of
                interventions for human review.
              </p>
            </div>

            <div className="priority-list">
              {data.priorities?.map((priority) => (
                <div className="priority-card" key={priority.priority}>
                  <div className="priority-number">
                    {String(priority.priority).padStart(2, "0")}
                  </div>

                  <div className="priority-content">
                    <span>RECOMMENDED PRIORITY</span>
                    <h3>{priority.action}</h3>
                    <p>{priority.reason}</p>
                  </div>

                  <div className="priority-arrow">↗</div>
                </div>
              ))}
            </div>
          </section>

          {/* AI PLAN */}
          <section className="ai-plan-section">
            <div className="ai-plan-glow"></div>

            <div className="ai-plan-content">
              <div className="ai-plan-label">
                <span>✦</span>
                AI RESILIENCE PLANNER
              </div>

              <h2>
                Turn assessment
                <br />
                into a resilience plan.
              </h2>

              <p>
                The next layer of RESILIO uses AI to interpret the assessment,
                explain why priorities matter and structure a practical action
                plan. Human planners remain responsible for reviewing and
                adapting the final recommendations.
              </p>

              <div className="ai-plan-steps">
                <div>
                  <span>01</span>
                  <strong>Interpret</strong>
                  <p>Understand the major risk drivers.</p>
                </div>

                <div>
                  <span>02</span>
                  <strong>Prioritize</strong>
                  <p>Compare urgency and intervention feasibility.</p>
                </div>

                <div>
                  <span>03</span>
                  <strong>Plan</strong>
                  <p>Generate explainable resilience actions.</p>
                </div>
              </div>

              <button
                className="plan-button"
                type="button"
                onClick={generateResiliencePlan}
                disabled={planLoading}
              >
                {planLoading ? "Generating plan..." : "Generate resilience plan"}
                <span>{planLoading ? "..." : "→"}</span>
              </button>

              {plan && (
                <div className="generated-plan-card">
                  <div className="generated-plan-header">
                    <div>
                      <span className="section-kicker">AI-GENERATED DECISION SUPPORT</span>
                      <div className="plan-indicators">
                        <span>{plan.model}</span>
                        <span>{plan.rag_enabled ? "RAG enabled" : "RAG unavailable"}</span>
                      </div>
                      <h3>Resilience plan for {plan.location}</h3>
                    </div>
                  </div>

                  <p className="plan-principle">{plan.risk_summary}</p>

                  <div className="generated-actions">
                    {plan.recommended_actions.map((item, index) => (
                      <div className="generated-action" key={`${item.title}-${index}`}>
                        <div className="generated-action-number">0{index + 1}</div>
                        <div>
                          <h4>{item.title}</h4>
                          <p>{item.action}</p>
                          <small>{item.reason}</small>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="human-review-note">
                    <span>✓</span>
                    <div>
                      <strong>Human-in-the-loop</strong>
                      <p>{plan.ai_note || "Recommendations are decision support and require human review before implementation."}</p>
                    </div>
                  </div>

                  <div className="plan-sources">
                    <strong>Knowledge references</strong>
                    <p>{(plan.sources || []).join(" · ")}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* WHAT IF */}
          <section className="dashboard-section scenario-section">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">SCENARIO PLANNING</span>
                <h2>What if conditions change?</h2>
              </div>

              <p>
                Explore controlled scenarios to understand how changing
                conditions could affect planning priorities.
              </p>
            </div>

            <div className="scenario-card">
              <div className="scenario-control">
                <div className="scenario-icon">⌁</div>

                <div>
                  <span>RAINFALL SCENARIO</span>
                  <h3>What if rainfall increases by 20%?</h3>
                </div>
              </div>

              <button
                type="button"
                className="scenario-button"
                onClick={runRainfallScenario}
                disabled={!data}
              >
                Run scenario <span>→</span>
              </button>
            </div>

            {scenarioResult && (
              <div className="scenario-result-card">
                <div className="scenario-result-header">
                  <div>
                    <span className="section-kicker">SCENARIO RESULT</span>
                    <h3>Impact of a 20% rainfall increase</h3>
                    <p>
                      A controlled what-if calculation using the same prototype
                      risk logic as the current assessment.
                    </p>
                  </div>

                  <div className="scenario-change-badge">
                    Overall {scenarioResult.current.overall} → {scenarioResult.scenario.overall}
                  </div>
                </div>

                <div className="scenario-metrics">
                  {[
                    ["Overall risk", scenarioResult.current.overall, scenarioResult.scenario.overall],
                    ["Flood", scenarioResult.current.flood, scenarioResult.scenario.flood],
                    ["Landslide", scenarioResult.current.landslide, scenarioResult.scenario.landslide],
                    ["Heatwave", scenarioResult.current.heat, scenarioResult.scenario.heat],
                    ["Cyclone", scenarioResult.current.cyclone, scenarioResult.scenario.cyclone],
                  ].map(([label, currentValue, scenarioValue]) => (
                    <div className="scenario-metric" key={label}>
                      <div>
                        <span>{label}</span>
                        <strong>{scenarioValue}/100</strong>
                      </div>

                      <div className="scenario-progress-track">
                        <div
                          className={`scenario-progress-current ${getRiskClass(currentValue)}`}
                          style={{ width: `${currentValue}%` }}
                        ></div>
                        <div
                          className={`scenario-progress-scenario ${getRiskClass(scenarioValue)}`}
                          style={{ width: `${scenarioValue}%` }}
                        ></div>
                      </div>

                      <small>
                        Current {currentValue} · Scenario {scenarioValue}
                      </small>
                    </div>
                  ))}
                </div>

                <div className="scenario-implication">
                  <span>↗</span>
                  <div>
                    <strong>Planning implication</strong>
                    <p>
                      Increased rainfall raises flood and terrain-related exposure,
                      so drainage preparedness and slope-sensitive infrastructure
                      should receive additional planning attention.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* DISCLAIMER */}
          <div className="prototype-note">
            <span>i</span>
            <p>
              <strong>Prototype note:</strong> Current climate indicators and
              risk values are demonstration data used to show the RESILIO
              workflow. They are not live measurements, official warnings or
              certified disaster forecasts.
            </p>
          </div>
        </main>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-brand">
          <div className="brand-mark small">R</div>
          <strong>RESILIO</strong>
        </div>

        <p>
          AI-powered climate resilience & community planning platform.
        </p>

        <div className="footer-right">
          <span>SDG 11</span>
          <span>SDG 13</span>
          <span>Human-in-the-loop</span>
        </div>
      </footer>
    </div>
  );
}

export default App;