import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  calculateScoresFromState,
  calculateCompletionFromState,
  countNonZeroWeightageMetrics,
  getPerformanceCategory,
} from '../../scoring';
import './Results.css';

const Results = ({ user }) => {
  const navigate = useNavigate();
  const { collectionName, assessmentId } = useParams();
  const [appState, setAppState] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        if (!user || !user.uid) return;
        const assessmentRef = doc(
          db,
          'users',
          user.uid,
          collectionName,
          assessmentId
        );
        const snap = await getDoc(assessmentRef);
        if (!snap.exists()) {
          setLoading(false);
          return;
        }
        const data = snap.data();
        setMeta({
          respondentName: data.respondentName,
          organisation: data.organisation,
          city: data.city,
          borough: data.borough,
          ward: data.ward,
          createdAt: data.createdAt,
        });
        setAppState(
          data.ratings && data.priorities && data.weights
            ? {
                ratings: data.ratings,
                priorities: data.priorities,
                weights: data.weights,
              }
            : null
        );
      } catch (err) {
        console.error('Error loading assessment:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [user, collectionName, assessmentId]);

  const computed = useMemo(() => {
    if (!appState) {
      return null;
    }
    const scores = calculateScoresFromState(appState);
    const completionPercent = calculateCompletionFromState(appState);
    const nonZeroMetrics = countNonZeroWeightageMetrics(appState);
    const performanceCategory = getPerformanceCategory(scores.overall);
    return {
      scores,
      completionPercent,
      nonZeroMetrics,
      performanceCategory,
    };
  }, [appState]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    navigate(`/score-dashboard/${collectionName}/${assessmentId}`);
  };

  if (loading) {
    return (
      <div className="results-container">
        <div className="results-loading">Loading assessment data...</div>
      </div>
    );
  }

  if (!appState || !computed || !meta) {
    return (
      <div className="results-container">
        <div className="results-error">No assessment data found.</div>
      </div>
    );
  }

  const { scores, completionPercent, nonZeroMetrics, performanceCategory } = computed;
  const overallScore = scores.overall;
  const overallPercentage = (overallScore / 5) * 100;

  const getGeneratedDate = () => {
    return new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="results-container">
      {/* Header Card */}
      <div className="results-header-card">
        <div className="results-header-content">
          <div className="results-header-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="8" y="20" width="6" height="12" rx="1" fill="#3b82f6"/>
              <rect x="16" y="16" width="6" height="16" rx="1" fill="#3b82f6"/>
              <rect x="24" y="12" width="6" height="20" rx="1" fill="#3b82f6"/>
              <rect x="4" y="24" width="4" height="8" rx="1" fill="#60a5fa"/>
              <rect x="30" y="18" width="4" height="14" rx="1" fill="#60a5fa"/>
            </svg>
          </div>
          <div className="results-header-text">
            <h1 className="results-header-title">SAFE Assessment Report</h1>
            <div className="results-header-divider"></div>
            <div className="results-header-subtitle">
              <div className="results-header-platform">Smart Age-Friendliness Evaluation Platform</div>
              <div className="results-header-generated">Generated: {getGeneratedDate()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="results-content">
        {/* Assessment Information Section */}
        <div className="results-section">
          <h2 className="results-section-title">Assessment Information</h2>
          <div className="results-table">
            <div className="results-table-header">
              <div className="results-table-header-cell">Field</div>
              <div className="results-table-header-cell">Value</div>
            </div>
            <div className="results-table-row">
              <div className="results-table-field">Respondent</div>
              <div className="results-table-value">{meta.respondentName || 'N/A'}</div>
            </div>
            <div className="results-table-row">
              <div className="results-table-field">Organization</div>
              <div className="results-table-value">{meta.organisation || 'N/A'}</div>
            </div>
            <div className="results-table-row">
              <div className="results-table-field">City</div>
              <div className="results-table-value">{meta.city || 'N/A'}</div>
            </div>
            <div className="results-table-row">
              <div className="results-table-field">Borough</div>
              <div className="results-table-value">{meta.borough || 'N/A'}</div>
            </div>
            <div className="results-table-row">
              <div className="results-table-field">Ward</div>
              <div className="results-table-value">{meta.ward || 'N/A'}</div>
            </div>
            <div className="results-table-row">
              <div className="results-table-field">Created</div>
              <div className="results-table-value">{formatDate(meta.createdAt)}</div>
            </div>
          </div>
        </div>

        {/* Overall Performance Section */}
        <div className="results-section">
          <h2 className="results-section-title">Overall Performance</h2>
          <div className="results-performance">
            <div className="results-performance-item">
              <span className="results-performance-label">Overall Score:</span>
              <span className="results-performance-value">
                {overallScore.toFixed(2)}/5 ({overallPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="results-performance-item">
              <span className="results-performance-label">Performance Category:</span>
              <span className="results-performance-value">{performanceCategory.name}</span>
            </div>
            <div className="results-performance-item">
              <span className="results-performance-label">Metrics with Non-Zero Weightage:</span>
              <span className="results-performance-value">{nonZeroMetrics}</span>
            </div>
            <div className="results-performance-item">
              <span className="results-performance-label">Completion Status:</span>
              <span className="results-performance-value">{completionPercent}%</span>
            </div>
          </div>
        </div>

        {/* Dimension Scores Section */}
        <div className="results-section">
          <h2 className="results-section-title">Dimension Scores</h2>
          <div className="results-table">
            <div className="results-table-header three-columns">
              <div className="results-table-header-cell">Dimension</div>
              <div className="results-table-header-cell">Score</div>
              <div className="results-table-header-cell">Percentage</div>
            </div>
            {Object.entries(scores.dimensions).map(([dimName, dimData]) => {
              const dimScore = dimData.score;
              const dimPercentage = (dimScore / 5) * 100;
              return (
                <div key={dimName} className="results-table-row three-columns">
                  <div className="results-table-dimension">{dimName}</div>
                  <div className="results-table-score">
                    {dimScore.toFixed(2)}/5
                  </div>
                  <div className="results-table-percentage">
                    {dimPercentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="results-actions">
          <button className="results-btn-print" onClick={handlePrint}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5V2C5 1.44772 5.44772 1 6 1H14C14.5523 1 15 1.44772 15 2V5M5 5H3C2.44772 5 2 5.44772 2 6V14C2 14.5523 2.44772 15 3 15H5M5 5H15M15 5H17C17.5523 5 18 5.44772 18 6V14C18 14.5523 17.5523 15 17 15H15M5 15V12C5 11.4477 5.44772 11 6 11H14C14.5523 11 15 11.4477 15 12V15M5 15H15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Print Report
          </button>
          <button className="results-btn-close" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;

