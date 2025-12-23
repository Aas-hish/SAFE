import React from 'react';
import './Layout.css';

const Layout = ({ children }) => (
  <div className="page">
    <div className="card">
      {children}
    </div>
  </div>
);

export default Layout;

