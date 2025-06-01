import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Landing.css';
import './LandingNavbar.css';
import LoginForm from '@/components/Auth/LoginForm';
import RegisterForm from '@/components/Auth/RegisterForm';

export default function LandingPage({ token, setToken, userName, setUserName, onLoginSuccess }) {
  const [showModal, setShowModal] = useState(false);
  const [authMode, setAuthMode] = useState('register');

  const openModal = (mode) => {
    setAuthMode(mode);
    setShowModal(true);
  };

  const handleLoginSuccess = () => {
    onLoginSuccess?.();
    setShowModal(false);
    window.location.href = '/schedule'; // ✅ Force full reload to /schedule
  };

  return (
    <>
      <nav className="custom-navbar">
        <div className="custom-container">
          <div className="navbar-flex">
            <a className="nav-header-title" href="/">FedMa</a>
            {!token ? (
              <div className="nav-user-button">
                <button className="btn btn-outline-primary" onClick={() => openModal('login')}>Login</button>
                <button className="btn btn-primary text-white fw-semibold" onClick={() => openModal('register')}>
                  Register
                </button>
              </div>
            ) : (
              <span className="navbar-text" style={{ color: 'var(--color-text-main)', fontSize: '0.9rem' }}>
                Welcome, {userName}
              </span>
            )}
          </div>
        </div>
      </nav>

      <main className="landing-main">
        {/* HERO */}
        <section className="landing-hero d-flex align-items-center">
          <div className="container">
            <div className="row align-items-center g-5">
              <div className="col-md-6">
                <h1 className="landing-heading">Lost at the gym? We’ve been there.</h1>
                <p className="landing-subtext">
                  Get a weekly plan built for your body. Train with your friends—even at different levels.
                </p>
                <button className="btn btn-primary text-white fw-semibold" onClick={() => openModal('register')}>
                  Get My Plan – Free Forever
                </button>
                <div className="landing-trust">Built by real gym-goers, not influencers</div>
              </div>
              <div className="col-md-6">
                <img
                  src="https://fedma.s3.us-east-2.amazonaws.com/landing/images/hero-persons-use.png"
                  alt="App demo"
                  className="landing-image"
                />
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM SECTION */}
        <section className="landing-section text-center">
          <div className="container">
            <h2 className="landing-subheading">Starting shouldn’t feel like a test.</h2>
            <p className="landing-paragraph">
              You signed up. You show up. But now what? No coach, no plan, no one to guide you.
              And if your friends are stronger or newer—it’s awkward.<br /><strong>Let’s change that.</strong>
            </p>
          </div>
        </section>

        {/* SOLUTION SECTION */}
        <section className="landing-section">
          <div className="container">
            <div className="row align-items-center g-5">
              <div className="col-md-6">
                <h2 className="landing-subheading">We make it simple.</h2>
                <p className="landing-paragraph">No guesswork. No planning. Just open the app and start.</p>
                <a href="#how-it-works" className="btn btn-outline-primary">See How It Works</a>
              </div>
              <div className="col-md-6">
                <img
                  src="https://fedma.s3.us-east-2.amazonaws.com/landing/images/hero-persons.png"
                  alt="UI Mockup"
                  className="landing-image"
                />
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS SECTION */}
        <section className="landing-section landing-benefits text-center">
          <div className="container">
            <h2 className="landing-subheading mb-4">Why You’ll Love It</h2>
            <div className="row g-3">
              {[
                { text: 'Tailored plans every week', icon: 'fa-calendar-check' },
                { text: 'Works solo or with your group', icon: 'fa-users' },
                { text: 'Built for your body and goals', icon: 'fa-dumbbell' },
                { text: 'Tap-to-learn tutorials', icon: 'fa-chalkboard-teacher' },
                { text: 'New every week to stay motivated', icon: 'fa-sync-alt' }
              ].map(({ text, icon }, i) => (
                <div key={i} className="col-md-4 col-sm-6">
                  <p>
                    <i className={`fas ${icon} text-accent me-2`}></i>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="landing-section" id="how-it-works">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-6 d-flex flex-column gap-4">
                <img
                  src="https://fedma.s3.us-east-2.amazonaws.com/landing/images/hero-app-demo.png"
                  alt="Creating Account"
                  className="benefits-image"
                />
              </div>
              <div className="col-md-6">
                <h2 className="landing-subheading mb-5">How It Works</h2>
                <ul className="benefit-list">
                  {[
                    'Create an account',
                    'Set your goal & body data',
                    'Get your plan & start training'
                  ].map((text, i) => (
                    <li key={i} className="benefit-step">
                      <span className="benefit-number">{String(i + 1).padStart(2, '0')}</span>
                      <span className="benefit-text">{text}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-center text-md-start mt-4">
                  <button className="btn btn-primary text-white fw-semibold" onClick={() => openModal('register')}>
                    Start Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="landing-section text-center">
          <div className="container">
            <h2 className="landing-subheading mb-4">Real Users, Real Results</h2>
            {[
              '“Finally made gym a habit.”',
              '“Could go with friends even if they’re stronger.”',
              '“Loved how everything was just ready.”'
            ].map((quote, i) => (
              <blockquote key={i} className="testimonial-blockquote">{quote}</blockquote>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="landing-section text-center">
          <h2 className="landing-heading">Less planning. More lifting.</h2>
          <p className="landing-subtext">Start your weekly plan today—tailored to you, synced with your crew.</p>
          <button className="btn btn-primary text-white fw-semibold" onClick={() => openModal('register')}>
            Start Free – 2 Min Setup
          </button>
        </section>
      </main>

      {/* AUTH MODALS */}
      {authMode === 'login' && (
        <LoginForm
          show={showModal}
          onHide={() => setShowModal(false)}
          setToken={setToken}
          onLoginSuccess={handleLoginSuccess}
          setAuthMode={setAuthMode}
        />
      )}
      {authMode === 'register' && (
        <RegisterForm
          show={showModal}
          onHide={() => setShowModal(false)}
          setToken={setToken}
          onLoginSuccess={handleLoginSuccess}
          setAuthMode={setAuthMode}
        />
      )}
    </>
  );
}
