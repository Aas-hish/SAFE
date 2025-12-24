import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  const displayName = useMemo(
    () => user?.username || user?.displayName || user?.email?.split('@')[0] || 'User',
    [user],
  );

  const userEmail = useMemo(
    () => user?.email || '',
    [user],
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleCreateAssessment = () => {
    navigate('/assessment');
  };

  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-navbar">
        <div className="navbar-brand">
          <span className="brand-icon">🔷</span>
          <span className="brand-text">SAFE Tracker</span>
        </div>
        <div className="navbar-right">
          <div className="profile-dropdown" ref={profileMenuRef}>
            <button
              className="profile-button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="profile-avatar">{getInitials()}</div>
              <span className="profile-name">{displayName}</span>
              <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu-header">
                  <div className="profile-menu-avatar">{getInitials()}</div>
                  <div className="profile-menu-info">
                    <div className="profile-menu-name">{displayName}</div>
                    <div className="profile-menu-email">{userEmail}</div>
                  </div>
                </div>
                <div className="profile-menu-divider"></div>
                <button className="profile-menu-item" onClick={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M10 11l4-4-4-4M14 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <section className="dashboard-hero">
            <div className="hero-left">
              <div className="hero-pill">
                <span className="hero-pill-dot" />
                Welcome back,
                {' '}
                <span className="hero-pill-name">{displayName}</span>
              </div>
              <h1 className="hero-title">
                Start your next
                {' '}
                <span>SAFE assessment</span>
                .
              </h1>
              <p className="hero-subtitle">
                Use SAFE Tracker to set up the context for your city or borough,
                then move through the full age‑friendliness framework one step at a time.
                Your inputs will feed into dashboards and insights that support planning
                and decision‑making.
              </p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="hero-primary-button"
                  onClick={handleCreateAssessment}
                >
                  Create a new assessment
                </button>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Workspace</h2>
                <p>Quick actions to manage your age‑friendliness assessments.</p>
              </div>
            </div>

            <div className="dashboard-actions">
              <div className="action-card" onClick={handleCreateAssessment}>
                <div className="action-icon">📋</div>
                <h3>Create Assessment</h3>
                <p>Start a new age‑friendliness assessment for your community.</p>
                <button type="button" className="action-button">
                  Get Started →
                </button>
              </div>

              <div className="action-card disabled">
                <div className="action-icon">📊</div>
                <h3>View Assessments</h3>
                <p>Review and analyse previous assessments and scorecards.</p>
                <button type="button" className="action-button" disabled>
                  Coming Soon
                </button>
              </div>

              <div className="action-card disabled">
                <div className="action-icon">📈</div>
                <h3>Analytics</h3>
                <p>Unlock deeper insights, trends, and benchmarking reports.</p>
                <button type="button" className="action-button" disabled>
                  Coming Soon
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

