import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { calculateCompletionFromState } from '../../scoring';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [assessments, setAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);

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

  // Fetch all assessments for the user
  useEffect(() => {
    const fetchAssessments = async () => {
      if (!user || !user.uid) {
        setLoadingAssessments(false);
        return;
      }

      try {
        const assessmentsList = [];
        
        // 1. Query assessments_index to get all assessment references
        const indexRef = collection(db, 'users', user.uid, 'assessments_index');
        const indexQuery = query(indexRef, orderBy('createdAt', 'desc'));
        const indexSnapshot = await getDocs(indexQuery);
        
        if (!indexSnapshot.empty) {
          // If index exists, use it to fetch actual assessments
          for (const indexDoc of indexSnapshot.docs) {
            const indexData = indexDoc.data();
            const assessmentRef = doc(
              db,
              'users',
              user.uid,
              indexData.collectionName,
              indexData.assessmentId
            );
            const assessmentSnap = await getDoc(assessmentRef);
            
            if (assessmentSnap.exists()) {
              const data = assessmentSnap.data();
              
              // Get completionPercentage directly from Firestore if it exists
              let completionPercentage = data.completionPercentage || 0;
              
              // If not stored in Firestore or is 0, calculate it as fallback
              if ((completionPercentage === 0 || completionPercentage === undefined) && data.ratings) {
                completionPercentage = calculateCompletionFromState({
                  ratings: data.ratings || {},
                  priorities: data.priorities || {},
                  weights: data.weights || { kpis: {}, metrics: {} },
                });
              }

              assessmentsList.push({
                id: assessmentSnap.id,
                collectionName: indexData.collectionName,
                respondentName: data.respondentName || 'N/A',
                organisation: data.organisation || 'N/A',
                city: data.city || 'N/A',
                borough: data.borough || 'N/A',
                ward: data.ward || 'N/A',
                status: data.status || 'draft',
                createdAt: data.createdAt,
                lastUpdated: data.lastUpdated,
                completionPercentage: completionPercentage,
              });
            }
          }
        } else {
          // 2. Fallback: If index is empty, query common city collections directly
          // This helps with existing assessments that don't have index entries yet
          const commonCollections = [
            'assessments_banglore',
            'assessments_london',
            'assessments_paris',
            'assessments_new_york',
            'assessments_tokyo',
          ];

          for (const collName of commonCollections) {
            try {
              const collRef = collection(db, 'users', user.uid, collName);
              const q = query(collRef, orderBy('createdAt', 'desc'));
              const snapshot = await getDocs(q);
              
              snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                // Only include if created by this user
                if (data.createdBy === user.uid) {
                  // Get completionPercentage directly from Firestore
                  let completionPercentage = data.completionPercentage || 0;
                  
                  // Fallback calculation if not stored
                  if ((completionPercentage === 0 || completionPercentage === undefined) && data.ratings) {
                    completionPercentage = calculateCompletionFromState({
                      ratings: data.ratings || {},
                      priorities: data.priorities || {},
                      weights: data.weights || { kpis: {}, metrics: {} },
                    });
                  }

                  assessmentsList.push({
                    id: docSnap.id,
                    collectionName: collName,
                    respondentName: data.respondentName || 'N/A',
                    organisation: data.organisation || 'N/A',
                    city: data.city || 'N/A',
                    borough: data.borough || 'N/A',
                    ward: data.ward || 'N/A',
                    status: data.status || 'draft',
                    createdAt: data.createdAt,
                    lastUpdated: data.lastUpdated,
                    completionPercentage: completionPercentage,
                  });
                }
              });
            } catch (err) {
              // Collection doesn't exist or query failed, skip it
              continue;
            }
          }
        }

        // Sort all assessments by createdAt descending
        assessmentsList.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return bTime - aTime;
        });

        setAssessments(assessmentsList);
      } catch (error) {
        console.error('Error fetching assessments:', error);
        setAssessments([]);
      } finally {
        setLoadingAssessments(false);
      }
    };

    fetchAssessments();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleCreateAssessment = () => {
    navigate('/assessment');
  };

  const handleResumeAssessment = (assessment) => {
    navigate('/assessment-dashboard', {
      state: {
        assessmentData: {
          id: assessment.id,
          collectionName: assessment.collectionName,
          respondentName: assessment.respondentName,
          organisation: assessment.organisation,
          city: assessment.city,
          borough: assessment.borough,
          ward: assessment.ward,
          createdAt: assessment.createdAt,
          status: assessment.status,
        },
      },
    });
  };

  const handleViewScoreDashboard = (assessment) => {
    navigate(`/score-dashboard/${assessment.collectionName}/${assessment.id}`);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'N/A';
    }
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
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Your Assessments</h2>
                <p>View and resume your previous age‑friendliness assessments.</p>
              </div>
            </div>

            {loadingAssessments ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Loading your assessments...</p>
              </div>
            ) : assessments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <p>No assessments yet. Create your first assessment to get started!</p>
              </div>
            ) : (
              <div className="assessments-grid">
                {assessments.map((assessment) => (
                  <div key={`${assessment.collectionName}-${assessment.id}`} className="assessment-card">
                    <div className="assessment-card-header">
                      <div className="assessment-card-title">
                        <h3>{assessment.city}</h3>
                        <span className={`status-badge status-${assessment.status}`}>
                          {assessment.status === 'draft' ? 'Draft' : 'Completed'}
                        </span>
                      </div>
                      <div className="assessment-card-meta">
                        <span>{assessment.borough}, {assessment.ward}</span>
                      </div>
                    </div>
                    
                    <div className="assessment-card-body">
                      <div className="assessment-info-row">
                        <span className="info-label">Respondent:</span>
                        <span className="info-value">{assessment.respondentName}</span>
                      </div>
                      <div className="assessment-info-row">
                        <span className="info-label">Organization:</span>
                        <span className="info-value">{assessment.organisation}</span>
                      </div>
                      <div className="assessment-info-row">
                        <span className="info-label">Created:</span>
                        <span className="info-value">{formatDate(assessment.createdAt)}</span>
                      </div>
                      
                      <div className="assessment-progress">
                        <div className="progress-label">
                          <span>Completion</span>
                          <span className="progress-percentage">{assessment.completionPercentage}%</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${assessment.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="assessment-card-actions">
                      {assessment.completionPercentage < 100 ? (
                        <button
                          type="button"
                          className="btn-resume"
                          onClick={() => handleResumeAssessment(assessment)}
                        >
                          Resume Assessment
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-view-score"
                          onClick={() => handleViewScoreDashboard(assessment)}
                        >
                          View Score Dashboard
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;