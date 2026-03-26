
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import './StationAdminDashboard.css';

const CATEGORY_CONFIG = {
  police: { label: 'Police', color: '#1e3a5f', icon: '👮' },
  fire: { label: 'Fire', color: '#dc2626', icon: '🚒' },
  ambulance: { label: 'Ambulance', color: '#10b981', icon: '🚑' }
};

const StationAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('open');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pulseAnim, setPulseAnim] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef(null);
  const notifIdRef = useRef(0);
  const audioRef = useRef(null);

  // Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAnim(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Create audio element for notification sound
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZF/cWtxfIeTkYJzaW55hJKRg3Nqb3uGkpCCcmlueYWSkYNzam97hpKQgnJpbnmFkpGDc2pve4aSkIJyaW55hZKRg3Nqb3uGko+CcsA=');
    audioRef.current.volume = 0.3;
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase.from('incidents').select(`
        *,
        user:profiles!incidents_user_id_fkey (
          name,
          phone
        ),
        responder:profiles!incidents_responder_id_fkey (
          name,
          role
        )
      `);

      if (user?.role === 'police_station') {
        query = query.contains('categories', ['police']);
      } else if (user?.role === 'fire_station') {
        query = query.contains('categories', ['fire']);
      } else if (user?.role === 'ambulance_station') {
        query = query.contains('categories', ['ambulance']);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    fetchIncidents();

    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
        // Refresh data on any change
        fetchIncidents();

        // Show notification toast for new incidents
        if (payload.eventType === 'INSERT') {
          const newIncident = payload.new;
          // Check if this incident is relevant to this station
          let isRelevant = true;
          if (user?.role === 'police_station' && !newIncident.categories?.includes('police')) isRelevant = false;
          if (user?.role === 'fire_station' && !newIncident.categories?.includes('fire')) isRelevant = false;
          if (user?.role === 'ambulance_station' && !newIncident.categories?.includes('ambulance')) isRelevant = false;

          if (isRelevant) {
            addNotification({
              title: '🚨 New Emergency Report',
              message: newIncident.title || 'A new incident has been reported',
              incidentId: newIncident.id,
              time: new Date().toLocaleTimeString()
            });
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, fetchIncidents]);

  const addNotification = (notif) => {
    const id = ++notifIdRef.current;
    setNotifications(prev => [{ ...notif, id }, ...prev].slice(0, 20));
    setUnreadCount(prev => prev + 1);

    // Play sound
    try { audioRef.current?.play().catch(() => {}); } catch(e) {}

    // Auto-dismiss toast after 5 seconds
    setTimeout(() => {
      const toastEl = document.getElementById(`toast-${id}`);
      if (toastEl) toastEl.classList.add('toast-exit');
      setTimeout(() => {
        const el = document.getElementById(`toast-${id}`);
        if (el) el.remove();
      }, 300);
    }, 5000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/professional-login');
  };

  const handleIncidentAction = (incidentId) => {
    navigate(`/incident-details/${incidentId}`);
  };

  
  const userIncidents = incidents;
  const openTickets = userIncidents.filter(i => i.status === 'pending').length;
  const inProgress = userIncidents.filter(i =>
    ['accepted', 'arrived', 'in_progress'].includes(i.status)
  ).length;
  const resolved = userIncidents.filter(i => i.status === 'completed').length;

  const filteredIncidents = userIncidents.filter(incident => {
    switch (activeTab) {
      case 'open':
        return incident.status === 'pending';
      case 'progress':
        return ['accepted', 'arrived', 'in_progress'].includes(incident.status);
      case 'completed':
        return incident.status === 'completed';
      default:
        return incident.status === 'pending';
    }
  });

  const getTabTitle = () => {
    switch (activeTab) {
      case 'open': return 'Open Tickets';
      case 'progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Open Tickets';
    }
  };

  const getRoleTitle = (role) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'police_station': return 'Police Station Admin';
      case 'ambulance_station': return 'Medical Station Admin';
      case 'fire_station': return 'Fire Station Admin';
      default: return 'Station Admin';
    }
  };

  const deployedResponders = userIncidents
    .filter(i => i.responder_id && ['accepted', 'in_progress', 'arrived'].includes(i.status));

  const deployedUnits = new Set(deployedResponders.map(i => i.responder_id)).size;

  const [showDeployedPanel, setShowDeployedPanel] = useState(false);

  return (
    <div className="station-admin-container">
      <div className="dashboard-gradient-bg">
        <div className="dashboard-content-wrapper">

          {/* Notification Toasts */}
          <div className="toast-container">
            {notifications.slice(0, 3).map(notif => (
              <div key={notif.id} id={`toast-${notif.id}`} className="toast-notification">
                <div className="toast-content">
                  <span className="toast-title">{notif.title}</span>
                  <span className="toast-message">{notif.message}</span>
                </div>
                <button className="toast-action" onClick={() => {
                  if (notif.incidentId) navigate(`/incident-details/${notif.incidentId}`);
                }}>View</button>
              </div>
            ))}
          </div>

          {/* Header Row - Full Width */}
          <div className="header-row">
            <header className="dashboard-header uniform-card">
              <div className="header-left">
                <div className="avatar-placeholder">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="avatar-image" />
                  ) : (
                    <span className="avatar-icon">👤</span>
                  )}
                </div>
                <div className="header-text">
                  <h1 className="dashboard-title">Welcome, {user?.name || 'Admin'}</h1>
                  <p className="dashboard-role">{getRoleTitle(user?.role)}</p>
                </div>
              </div>
              <div className="header-right-actions">
                <button className="notif-bell-btn" onClick={() => { setShowNotifPanel(!showNotifPanel); setUnreadCount(0); }}>
                  🔔
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                <button onClick={handleLogout} className="logout-btn">
                  <span>🚪</span> Logout
                </button>
              </div>
            </header>

            {/* Notification Panel */}
            {showNotifPanel && (
              <div className="notif-panel uniform-card">
                <div className="notif-panel-header">
                  <h3>Notifications</h3>
                  <button onClick={() => setNotifications([])}>Clear All</button>
                </div>
                {notifications.length === 0 ? (
                  <p className="notif-empty">No notifications yet</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="notif-item" onClick={() => {
                      if (n.incidentId) navigate(`/incident-details/${n.incidentId}`);
                      setShowNotifPanel(false);
                    }}>
                      <span className="notif-item-title">{n.title}</span>
                      <span className="notif-item-msg">{n.message}</span>
                      <span className="notif-item-time">{n.time}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Main Content - Two Columns */}
          <div className="main-content-row">
            {/* Left Column */}
            <div className="left-column">
              {/* Command Summary Card */}
              <div className="uniform-card">
                <h2 className="section-title">Command Summary</h2>
                <div className="command-hero-grid">
                  <div className="command-hero-card clickable" onClick={() => navigate('/active-reports')}>
                    <div className="command-hero-header">
                      <div className="command-hero-icon-circle">
                        <span className="command-icon">⚡</span>
                      </div>
                      <div className={`live-badge ${pulseAnim ? 'pulse' : ''}`}>
                        <span className="live-badge-text">LIVE</span>
                      </div>
                    </div>
                    <div className="command-hero-count">{openTickets + inProgress}</div>
                    <div className="command-hero-label">ACTIVE EMERGENCIES</div>
                  </div>

                  <div className="command-hero-card clickable" onClick={() => setShowDeployedPanel(!showDeployedPanel)}>
                    <div className="command-hero-header">
                      <div className="command-hero-icon-circle">
                        <span className="command-icon">🛡️</span>
                      </div>
                      <div className="unit-badge">
                        <span className="unit-badge-text">UNITS</span>
                      </div>
                    </div>
                    <div className="command-hero-count">{deployedUnits}</div>
                    <div className="command-hero-label">FORCE DEPLOYED</div>
                  </div>
                </div>

                {/* Deployed Responders Panel */}
                {showDeployedPanel && (
                  <div className="deployed-panel">
                    <h3 className="deployed-panel-title">Deployed Responders</h3>
                    {deployedResponders.length === 0 ? (
                      <p className="deployed-empty">No responders currently deployed</p>
                    ) : (
                      deployedResponders.map(i => (
                        <div key={i.id} className="deployed-item" onClick={() => navigate(`/map?trackingIncidentId=${i.id}`)}>
                          <div className="deployed-item-info">
                            <span className="deployed-responder-name">🛡️ {i.responder?.name || 'Unknown Responder'}</span>
                            <span className="deployed-incident-title">→ {i.title}</span>
                          </div>
                          <span className="deployed-track-btn">🗺️ Track</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Ticket Tracking Card */}
              <div className="uniform-card">
                <h2 className="section-title">Ticket Tracking</h2>
                <div className="status-cards-grid">
                  <button
                    className={`status-card ${activeTab === 'open' ? 'active' : ''}`}
                    onClick={() => setActiveTab('open')}
                  >
                    <span className="card-icon">💬</span>
                    <span className="status-card-title">Open</span>
                    <span className="card-count">{openTickets}</span>
                  </button>

                  <button
                    className={`status-card ${activeTab === 'progress' ? 'active' : ''}`}
                    onClick={() => setActiveTab('progress')}
                  >
                    <span className="card-icon">📌</span>
                    <span className="status-card-title">In Progress</span>
                    <span className="card-count">{inProgress}</span>
                  </button>

                  <button
                    className={`status-card ${activeTab === 'completed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('completed')}
                  >
                    <span className="card-icon">❤️</span>
                    <span className="status-card-title">Completed</span>
                    <span className="card-count">{resolved}</span>
                  </button>
                </div>
              </div>

              {/* Administrative Tools Card */}
              <div className="uniform-card">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions-grid">
                  <button className="quick-action-item" onClick={() => navigate('/manage-users')}>
                    <div className="stat-icon">
                      <span className="stat-icon-text">👥</span>
                    </div>
                    <span className="quick-action-label">Users</span>
                  </button>
                  <button className="quick-action-item" onClick={() => navigate('/registered-users')}>
                    <div className="stat-icon">
                      <span className="stat-icon-text">🛡️</span>
                    </div>
                    <span className="quick-action-label">Registered Citizens</span>
                  </button>
                  <button className="quick-action-item" onClick={() => navigate('/manage-stations')}>
                    <div className="stat-icon">
                      <span className="stat-icon-text">🏢</span>
                    </div>
                    <span className="quick-action-label">Stations</span>
                  </button>
                  <button className="quick-action-item" onClick={() => navigate('/map')}>
                    <div className="stat-icon">
                      <span className="stat-icon-text">🗺️</span>
                    </div>
                    <span className="quick-action-label">Map</span>
                  </button>
                  <button className="quick-action-item" onClick={() => navigate('/incidents')}>
                    <div className="stat-icon">
                      <span className="stat-icon-text">📋</span>
                    </div>
                    <span className="quick-action-label">All Reports</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="right-column">
              {/* Tickets Card */}
              <div className="uniform-card" style={{ height: '100%' }}>
                <div className="tickets-header">
                  <h2 className="tickets-title">{getTabTitle()}</h2>
                  <div className="realtime-indicator">
                    <div className="realtime-dot" />
                    <span>Real-time</span>
                  </div>
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-spinner">⏳</div>
                      <p>Loading incidents...</p>
                    </div>
                  ) : filteredIncidents.length === 0 ? (
                    <div className="empty-tickets">
                      <p>No {getTabTitle().toLowerCase()}</p>
                    </div>
                  ) : (
                    filteredIncidents.map((incident) => {
                      const primaryCategory = incident.categories?.find(cat =>
                        ['police', 'fire', 'ambulance'].includes(cat)
                      ) || 'police';

                      const categoryConfig = CATEGORY_CONFIG[primaryCategory];

                      return (
                        <div key={incident.id} className="ticket-card">
                          <div className="ticket-header">
                            <div className="reporter-info">
                              <p className="reporter-name">
                                {incident.user?.name || 'Unknown'}
                              </p>
                              <p className="reporter-number">
                                <span>📞</span> {incident.user?.phone || 'N/A'}
                              </p>
                            </div>
                            <div className="action-buttons">
                              <button
                                className="check-button check-btn"
                                onClick={() => handleIncidentAction(incident.id)}
                              >
                                Check
                              </button>
                            </div>
                          </div>

                          <div className="ticket-details">
                            <h4 className="emergency-title">{incident.title}</h4>

                            <div className="detail-row">
                              <span className="detail-label">📍 Location</span>
                              <span className="detail-text">{incident.address || 'Not specified'}</span>
                            </div>

                            <div className="detail-row">
                              <span className="detail-label">🚨 Service</span>
                              <span
                                className="category-badge"
                                style={{ backgroundColor: categoryConfig?.color }}
                              >
                                {categoryConfig?.label}
                              </span>
                            </div>

                            <div className="date-time-row">
                              <div className="detail-row">
                                <span className="detail-label">📅 Date</span>
                                <span className="detail-text">
                                  {new Date(incident.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">⏰ Time</span>
                                <span className="detail-text">
                                  {new Date(incident.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationAdminDashboard;