import { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    onLogin();
  };

  return (
    <div className="login-page">
      <div className="login-bg-shape login-bg-shape-one"></div>
      <div className="login-bg-shape login-bg-shape-two"></div>

      <div className="login-shell">

        {/* LEFT SIDE */}
        <section className="login-visual">
          <div className="login-visual-image"></div>
          <div className="login-visual-overlay"></div>

          <div className="login-visual-content">
            <div className="login-mini-brand">
              <div className="login-mini-logo">R</div>
              <span>RESILIO</span>
            </div>

            <div className="login-visual-text">
              <p className="login-eyebrow">
                CLIMATE RESILIENCE PLATFORM
              </p>

              <h2>
                Understand risk.
                <br />
                Plan resilience.
              </h2>

              <p>
                Turn climate and infrastructure risk into clear,
                practical planning decisions for communities.
              </p>
            </div>

            <div className="login-flow">
              <div className="login-flow-item">
                <span>01</span>
                <div>
                  <strong>Assess</strong>
                  <small>Understand local risk</small>
                </div>
              </div>

              <div className="login-flow-line"></div>

              <div className="login-flow-item">
                <span>02</span>
                <div>
                  <strong>Prioritize</strong>
                  <small>Identify what matters most</small>
                </div>
              </div>

              <div className="login-flow-line"></div>

              <div className="login-flow-item">
                <span>03</span>
                <div>
                  <strong>Plan</strong>
                  <small>Create resilience actions</small>
                </div>
              </div>
            </div>
          </div>

          <div className="login-location-pill">
            <span className="login-location-dot"></span>
            <span>Community resilience planning</span>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <section className="login-form-panel">
          <div className="login-form-inner">

            <div className="login-form-top">
              <div className="login-form-logo">
                R
              </div>

              <div>
                <span className="login-form-brand">
                  RESILIO
                </span>
                <span className="login-form-brand-sub">
                  Climate Resilience & Community Planning
                </span>
              </div>
            </div>

            <div className="login-heading">
              <p className="login-section-label">WELCOME BACK</p>

              <h1>
                Sign in to your
                <br />
                resilience workspace.
              </h1>

              <p>
                Access your climate risk assessments, priority actions,
                and resilience planning tools.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">

              <div className="login-field">
                <label htmlFor="email">Email address</label>

                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    @
                  </span>

                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>

                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    •
                  </span>

                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="login-options">
                <label className="login-check">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>

                <span className="login-forgot">
                  Prototype access
                </span>
              </div>

              <button type="submit" className="login-button">
                <span>Enter RESILIO</span>
                <span className="login-button-arrow">→</span>
              </button>
            </form>

            <div className="login-divider">
              <span></span>
              <p>Decision support for resilient communities</p>
              <span></span>
            </div>

            <div className="login-sdg-row">
              <div className="login-sdg">
                <span className="login-sdg-number">11</span>
                <div>
                  <strong>Sustainable Cities</strong>
                  <small>Primary SDG focus</small>
                </div>
              </div>

              <div className="login-sdg">
                <span className="login-sdg-number blue">13</span>
                <div>
                  <strong>Climate Action</strong>
                  <small>Secondary SDG focus</small>
                </div>
              </div>
            </div>

            <p className="login-note">
              RESILIO is a sustainability project prototype.
              Recommendations are intended as decision-support
              suggestions and should be reviewed by responsible planners.
            </p>

          </div>
        </section>
      </div>
    </div>
  );
}