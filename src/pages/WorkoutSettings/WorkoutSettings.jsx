import React, { useMemo, useState } from 'react';
import { FaDumbbell, FaMapMarkerAlt } from 'react-icons/fa';
import { TbActivityHeartbeat } from 'react-icons/tb';
import './WorkoutSettings.css';

const splitOptions = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'Balanced 3-day rotation focusing on compound strength and hypertrophy.',
    summary: 'Great for 3-6 day schedules and progressive overload.'
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: 'Alternating days to prioritize big lifts while keeping recovery in check.',
    summary: 'Pairs well with 4 day plans and intermediate lifters.'
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Efficient routines that hit every major group each session.',
    summary: 'Ideal for busy schedules or re-entry training.'
  },
  {
    id: 'body-part',
    name: 'Body Part Focus',
    description: 'Classic bodybuilding style targeting one major area per day.',
    summary: 'Best for advanced users with 5-6 day availability.'
  }
];

const equipmentOptions = [
  'Dumbbells',
  'Barbell',
  'Resistance Bands',
  'Machines',
  'Bodyweight',
  'Kettlebells'
];

const locationOptions = [
  { id: 'home', name: 'Home', helper: 'Great for quick sessions and flexible timing.' },
  { id: 'gym', name: 'Gym', helper: 'Access to full equipment and spotters.' },
  { id: 'park', name: 'Park', helper: 'Outdoor conditioning and bodyweight flows.' },
  { id: 'studio', name: 'Studio', helper: 'Group classes or small-group training spaces.' }
];

const tabs = [
  { id: 'split', label: 'Workout Split', icon: <TbActivityHeartbeat aria-hidden="true" /> },
  { id: 'equipment', label: 'Equipment', icon: <FaDumbbell aria-hidden="true" /> },
  { id: 'locations', label: 'Locations', icon: <FaMapMarkerAlt aria-hidden="true" /> }
];

export default function WorkoutSettings() {
  const [activeTab, setActiveTab] = useState('split');
  const [activeSplitId, setActiveSplitId] = useState(splitOptions[0].id);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(['Dumbbells', 'Bodyweight']);
  const [selectedLocations, setSelectedLocations] = useState(['home']);

  const settingsPayload = useMemo(
    () => ({
      split: activeSplitId,
      equipment: selectedEquipment,
      locations: selectedLocations
    }),
    [activeSplitId, selectedEquipment, selectedLocations]
  );

  const handleSplitSelect = (splitId) => {
    setActiveSplitId(splitId);
  };

  const toggleEquipment = (item) => {
    setSelectedEquipment(prev =>
      prev.includes(item) ? prev.filter(equipment => equipment !== item) : [...prev, item]
    );
  };

  const toggleLocation = (locationId) => {
    setSelectedLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(location => location !== locationId)
        : [...prev, locationId]
    );
  };

  const isEquipmentSelected = (item) => selectedEquipment.includes(item);
  const isLocationSelected = (locationId) => selectedLocations.includes(locationId);

  const renderSplitCards = () => (
    <div className="card-grid" role="radiogroup" aria-label="Workout split options">
      {splitOptions.map(split => {
        const isActive = split.id === activeSplitId;
        return (
          <article
            key={split.id}
            className={`settings-card ${isActive ? 'active' : ''}`}
            role="radio"
            aria-checked={isActive}
            tabIndex={0}
            onClick={() => handleSplitSelect(split.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSplitSelect(split.id);
              }
            }}
          >
            <div className="card-header">
              <div>
                <p className="eyebrow">Split</p>
                <h3 className="card-title">{split.name}</h3>
                <p className="card-description">{split.description}</p>
              </div>
              <div className={`toggle ${isActive ? 'on' : 'off'}`} aria-hidden="true">
                <div className="toggle-handle" />
              </div>
            </div>
            <p className="card-summary">{split.summary}</p>
            <div className="card-footer">
              <span className="pill">{isActive ? 'Active' : 'Activate'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );

  const renderEquipmentSelector = () => (
    <div className="equipment-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Equipment</p>
          <h3 className="card-title">Available equipment</h3>
          <p className="card-description">
            Choose everything you have access to. We will tailor exercises to what you can actually use.
          </p>
        </div>
        <button
          type="button"
          className={`pill-button ${equipmentOpen ? 'open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={equipmentOpen}
          onClick={() => setEquipmentOpen(open => !open)}
        >
          {equipmentOpen ? 'Hide list' : 'Choose equipment'}
        </button>
      </div>

      <div className={`equipment-dropdown ${equipmentOpen ? 'open' : ''}`} role="listbox" aria-multiselectable="true">
        {equipmentOptions.map(option => (
          <label key={option} className="equipment-option">
            <input
              type="checkbox"
              checked={isEquipmentSelected(option)}
              onChange={() => toggleEquipment(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>

      <div className="selection-preview" aria-live="polite">
        {selectedEquipment.length === 0 ? (
          <p className="card-description">No equipment selected yet.</p>
        ) : (
          selectedEquipment.map(item => (
            <span key={item} className="selection-chip">
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );

  const renderLocationCards = () => (
    <div className="card-grid" aria-label="Workout locations">
      {locationOptions.map(location => {
        const isActive = isLocationSelected(location.id);
        return (
          <article
            key={location.id}
            className={`settings-card ${isActive ? 'active' : ''}`}
            role="checkbox"
            aria-checked={isActive}
            tabIndex={0}
            onClick={() => toggleLocation(location.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleLocation(location.id);
              }
            }}
          >
            <div className="card-header">
              <div>
                <p className="eyebrow">Location</p>
                <h3 className="card-title">{location.name}</h3>
                <p className="card-description">{location.helper}</p>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggleLocation(location.id)}
                />
                <span className="checkbox-control" aria-hidden="true" />
                <span className="sr-only">Use {location.name}</span>
              </label>
            </div>
            <div className="card-footer">
              <span className="pill subtle">{isActive ? 'Included' : 'Tap to include'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header className="settings-hero">
        <div>
          <p className="eyebrow">Workout Settings</p>
          <h1 id="settings-title">Fine-tune how and where you train</h1>
          <p className="hero-description">
            Choose your split, equipment, and training locations in one place. Your selections stay ready for syncing
            with the backend so programs stay personal.
          </p>
        </div>
        <div className="payload-preview" aria-live="polite">
          <p className="eyebrow">API-ready state</p>
          <pre>
{JSON.stringify(settingsPayload, null, 2)}
          </pre>
        </div>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Workout settings">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content" role="tabpanel">
        {activeTab === 'split' && renderSplitCards()}
        {activeTab === 'equipment' && renderEquipmentSelector()}
        {activeTab === 'locations' && renderLocationCards()}
      </div>
    </section>
  );
}
