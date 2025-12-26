import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import './Assessment.css';

const Assessment = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    respondentName: '',
    organisation: '',
    city: '',
    borough: '',
    ward: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Sanitize city name for Firestore collection name
  const sanitizeCollectionName = (cityName) => {
    // Remove special characters, replace spaces with underscores, convert to lowercase
    return cityName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50); // Firestore collection names have length limits
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user || !user.uid) {
        throw new Error('User not authenticated');
      }

      // Sanitize city name for collection name
      const cityName = formData.city.trim();
      if (!cityName) {
        throw new Error('City name is required');
      }

      const collectionName = `assessments_${sanitizeCollectionName(cityName)}`;
      
      // Create assessment document in the user's subcollection
      const assessmentData = {
        respondentName: formData.respondentName.trim(),
        organisation: formData.organisation.trim(),
        city: cityName,
        borough: formData.borough.trim(),
        ward: formData.ward.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        status: 'draft', // You can add status tracking
      };

      // Reference to the user's document and then the assessments subcollection
      const userRef = collection(db, 'users', user.uid, collectionName);
      
      // Add the assessment document
      const docRef = await addDoc(userRef, assessmentData);
      
      console.log('Assessment saved with ID:', docRef.id);
      
      // Create index entry for easy querying in Dashboard
      try {
        const indexRef = collection(db, 'users', user.uid, 'assessments_index');
        await addDoc(indexRef, {
          assessmentId: docRef.id,
          collectionName: collectionName,
          createdAt: serverTimestamp(),
          city: cityName,
          status: 'draft',
        });
      } catch (indexError) {
        // Index creation is optional, don't fail if it errors
        console.warn('Could not create assessment index:', indexError);
      }
      
      // Navigate to assessment dashboard with the assessment data
      navigate('/assessment-dashboard', {
        state: {
          assessmentData: {
            ...assessmentData,
            id: docRef.id,
            collectionName: collectionName, // Pass collection name for Firestore operations
            createdAt: new Date(), // Convert timestamp to Date for display
          },
        },
      });
      
    } catch (err) {
      console.error('Error saving assessment:', err);
      setError(err.message || 'Failed to save assessment. Please try again.');
      setLoading(false);
    }
  };

  const currentDate = new Date().toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="assessment-page">
      <div className="assessment-header-bar">
        <div className="assessment-header-content">
          <div className="header-icon">🔴</div>
          <h1 className="assessment-title">Assessment Context & Location Setup</h1>
        </div>
      </div>

      <div className="assessment-container">
        <div className="assessment-intro">
          <p className="intro-text">
            Welcome to the <strong>SAFE Tracker</strong> - a comprehensive platform to catalyse Age-Friendliness and improve Older Persons' lives.
          </p>
          <p className="intro-description">
            SAFE is a first-of-its-kind comprehensive digital tool to assess and track the age-friendliness of smart communities. It is well-researched and built around the WHO AFCC framework, the principles underpinning the UN Human Rights for Older Persons & standards prescribed by a range of global Frameworks around Inclusion, Smart City effectiveness & Accessibility.
          </p>
          <p className="intro-description">
            SAFE also provides advanced analytics, real-time assessment capabilities and AI-powered insights to drive urban planning and policy decisions.
          </p>
        </div>

        <div className="assessment-meta">
          <div className="meta-item">
            <svg className="meta-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 2v14M11 2v14M3 6h10M3 10h10" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Assessment Created: {currentDate}</span>
          </div>
        </div>

        <div className="assessment-instructions">
          <p>Please provide the following information to begin your age-friendliness assessment.</p>
        </div>

        {error && (
          <div className="assessment-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" fill="currentColor"/>
            </svg>
            {error}
          </div>
        )}

        <form className="assessment-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span className="field-label">Name of Respondent <span className="required">*</span></span>
              <input
                type="text"
                name="respondentName"
                value={formData.respondentName}
                onChange={handleChange}
                placeholder="Enter respondent name"
                required
                className="form-input"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Organisation / Team <span className="required">*</span></span>
              <input
                type="text"
                name="organisation"
                value={formData.organisation}
                onChange={handleChange}
                placeholder="Enter organisation or team name"
                required
                className="form-input"
              />
            </label>

            <label className="form-field">
              <span className="field-label">City <span className="required">*</span></span>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city name"
                required
                className="form-input"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Borough <span className="required">*</span></span>
              <input
                type="text"
                name="borough"
                value={formData.borough}
                onChange={handleChange}
                placeholder="Enter borough name"
                required
                className="form-input"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Ward <span className="required">*</span></span>
              <input
                type="text"
                name="ward"
                value={formData.ward}
                onChange={handleChange}
                placeholder="Enter ward name"
                required
                className="form-input"
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Continue to Assessment'}
              {!loading && (
                <>
                  <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="btn-folder-icon">📁</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Assessment;
