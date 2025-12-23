import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import './App.css';
import { auth, db } from './firebase';
import Login from './pages/Login/Login';
import Signup from './pages/Signup/Signup';
import Home from './pages/Home/Home';

function App() {
  const [user, setUser] = useState(undefined);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoadingProfile(false);
        return;
      }

      // If displayName exists, use it immediately.
      if (firebaseUser.displayName) {
        setUser({ ...firebaseUser, username: firebaseUser.displayName });
        setLoadingProfile(false);
        return;
      }

      // Otherwise fetch from Firestore before rendering.
      try {
        const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
        const username = snapshot.exists() ? snapshot.data().username : '';
        setUser({ ...firebaseUser, username });
      } catch (err) {
        setUser({ ...firebaseUser, username: '' });
      } finally {
        setLoadingProfile(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (user === undefined || loadingProfile) {
    return (
      <div className="page">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login user={user} />} />
        <Route path="/signup" element={<Signup user={user} />} />
        <Route
          path="/"
          element={(
            user ? <Home user={user} /> : <Navigate to="/login" replace />
          )}
        />
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
