import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import Layout from '../Layout';
import { auth } from '../../firebase';
import './Home.css';

const Home = ({ user }) => {
  const navigate = useNavigate();
  const displayName = useMemo(
    () => user?.username || user?.displayName || user?.email || 'user',
    [user],
  );

  

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <Layout>
      <div className="home-hero">
        <div className="home-badge">Dashboard</div>
        <h1>Hello, {displayName}</h1>
        <p>Welcome back! You&apos;re signed in and ready to explore.</p>
        <div className="home-actions">
          <button className="primary" onClick={handleLogout}>Log out</button>
        </div>
      </div>
    </Layout>
  );
};

export default Home;

