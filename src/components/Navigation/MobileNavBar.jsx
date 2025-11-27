// src/components/Navigation/MobileNavBar.jsx
import React from 'react';
import { MdHistory, MdHomeFilled } from 'react-icons/md';
import { useNavigate, useLocation } from 'react-router-dom';
import './MobileNavBar.css';

const MobileNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/schedule',
      icon: <MdHomeFilled aria-hidden="true" focusable="false" />,
      ariaLabel: 'Navigate to workout schedule'
    },
    {
      id: 'history',
      label: 'History',
      path: '/history',
      icon: <MdHistory aria-hidden="true" focusable="false" />,
      ariaLabel: 'Navigate to workout history'
    }
  ];

  const handleNavigation = (path) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const isActivePath = (path) => {
    // Handle exact matches and related paths
    if (path === '/schedule') {
      return location.pathname === '/schedule' || 
             location.pathname === '/workout-detail';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="mobile-nav-bar" role="navigation" aria-label="Main navigation">
      <div className="nav-container">
        {navItems.map((item) => {
          const isActive = isActivePath(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              aria-label={item.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavBar;