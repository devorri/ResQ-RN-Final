// src/ManageUsers.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { COLORS } from './constants/colors';
import './ManageUsers.css';

const ManageUsers = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const filter = searchParams.get('filter');
    const { user: currentUser } = useAuth();

    const [users, setUsers] = useState([]);
    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [formData, setFormData] = useState({});
    const [newUserData, setNewUserData] = useState({
        email: '',
        name: '',
        role: 'user',
        password: 'password123',
        station_id: null,
        service_type: undefined
    });

    const isSuperAdmin = currentUser?.role === 'admin';
    const isStationAdmin = ['police_station', 'fire_station', 'ambulance_station'].includes(currentUser?.role || '');

    // Set default role for station admins
    useEffect(() => {
        if (isStationAdmin) {
            let defaultRole = 'police_responder';
            if (currentUser?.role === 'fire_station') defaultRole = 'firefighter';
            if (currentUser?.role === 'ambulance_station') defaultRole = 'ambulance_responder';

            setNewUserData(prev => ({ ...prev, role: defaultRole }));
        }
    }, [currentUser?.role, isStationAdmin]);

    const ROLES = useMemo(() => {
        if (isSuperAdmin) {
            return [
                'user',
                'admin',
                'police_station',
                'fire_station',
                'ambulance_station',
                'police_responder',
                'firefighter',
                'ambulance_responder'
            ];
        }

        if (currentUser?.role === 'police_station') return ['police_responder'];
        if (currentUser?.role === 'fire_station') return ['firefighter'];
        if (currentUser?.role === 'ambulance_station') return ['ambulance_responder'];

        return ['user'];
    }, [currentUser?.role, isSuperAdmin]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);

            // Fetch Users
            let query = supabase.from('profiles').select('*');

            if (isStationAdmin) {
                let compatibleRoles = [];
                if (currentUser?.role === 'police_station') compatibleRoles = ['police_responder'];
                if (currentUser?.role === 'fire_station') compatibleRoles = ['firefighter'];
                if (currentUser?.role === 'ambulance_station') compatibleRoles = ['ambulance_responder'];
                query = query.in('role', compatibleRoles);
            }

            const { data: usersData, error: usersError } = await query.order('name');
            if (usersError) throw usersError;
            setUsers(usersData || []);

            // Fetch Stations
            let stationQuery = supabase.from('stations').select('*');
            if (isStationAdmin && currentUser?.station_id) {
                stationQuery = stationQuery.eq('id', currentUser.station_id);
            }

            const { data: stationsData, error: stationsError } = await stationQuery.order('name');
            if (stationsError) throw stationsError;
            setStations(stationsData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = (role) => {
        const isStationDependent = role !== 'user' && role !== 'admin';
        setFormData(prev => ({
            ...prev,
            role,
            station_id: isStationDependent ? prev.station_id : null,
            service_type: isStationDependent ? prev.service_type : undefined
        }));
    };

    const handleStationChange = (station) => {
        setFormData(prev => ({
            ...prev,
            station_id: station.id,
            service_type: station.type
        }));
    };

    const handleSave = async () => {
        try {
            if (!editingUser) return;
            setIsLoading(true);

            const isStationDependent = formData.role !== 'user' && formData.role !== 'admin';
            if (isStationDependent && !formData.station_id) {
                alert('This role requires a Station assignment.');
                setIsLoading(false);
                return;
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    role: formData.role,
                    station_id: formData.station_id,
                    service_type: formData.service_type,
                    status: formData.role === 'user' ? 'available' : (editingUser.status || 'available')
                })
                .eq('id', editingUser.id);

            if (error) throw error;

            setModalVisible(false);
            fetchData();
            alert('User updated successfully');
        } catch (error) {
            console.error('Error updating user:', error);
            alert(error.message || 'Failed to update user');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUser = async () => {
        try {
            if (!newUserData.email || !newUserData.name) {
                alert('Please fill in all fields');
                return;
            }

            // Validation: Enforce Station for dependent roles
            const isStationDependent = newUserData.role !== 'user' && newUserData.role !== 'admin';
            if (isStationDependent && !newUserData.station_id) {
                alert('This role requires a Station assignment.');
                return;
            }

            setIsLoading(true);

            // Insert directly into profiles table (Matching custom auth patterns)
            const { data, error } = await supabase
                .from('profiles')
                .insert([{
                    email: newUserData.email.trim().toLowerCase(),
                    name: newUserData.name.trim(),
                    role: newUserData.role,
                    password: newUserData.password,
                    station_id: newUserData.station_id,
                    service_type: newUserData.service_type,
                    status: 'available'
                }]);

            if (error) throw error;

            alert('User created successfully.');
            setModalVisible(false);
            setIsAddingUser(false);
            fetchData();
        } catch (error) {
            console.error('Error creating user:', error);
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (window.confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
            try {
                setIsLoading(true);
                const { error } = await supabase
                    .from('profiles')
                    .delete()
                    .eq('id', user.id);

                if (error) throw error;
                fetchData();
                alert('User profile removed');
            } catch (err) {
                alert(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const openModal = (user) => {
        setEditingUser(user);
        setFormData({
            role: user.role,
            station_id: user.station_id,
            service_type: user.service_type
        });
        setModalVisible(true);
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || '') ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase());

        if (filter === 'responders') {
            const isResponder = ['police_responder', 'firefighter', 'ambulance_responder'].includes(u.role);
            return matchesSearch && isResponder;
        }

        return matchesSearch;
    });

    const getRoleColor = (role) => {
        if (role.includes('admin')) return COLORS.text.primary;
        if (role.includes('police')) return COLORS.category.police;
        if (role.includes('fire')) return COLORS.category.fire;
        if (role.includes('ambulance')) return COLORS.category.ambulance;
        return COLORS.text.secondary;
    };

    const isStationDependent = formData.role && formData.role !== 'user' && formData.role !== 'admin';

    return (
        <div className="manage-users-container">
            <div className="manage-users-gradient-bg">
                <div className="manage-users-content-wrapper">

                    {/* Header */}
                    <div className="manage-users-header">
                        <div className="header-left-group">
                            <button className="back-btn" onClick={() => navigate(-1)}>
                                ⬅️
                            </button>
                            <h1 className="page-title">Manage Users</h1>
                        </div>
                        <button
                            className="add-user-btn"
                            onClick={() => {
                                let defaultRole = 'user';
                                if (currentUser?.role === 'police_station') defaultRole = 'police_responder';
                                if (currentUser?.role === 'fire_station') defaultRole = 'firefighter';
                                if (currentUser?.role === 'ambulance_station') defaultRole = 'ambulance_responder';

                                setNewUserData({
                                    email: '',
                                    name: '',
                                    role: isSuperAdmin ? 'user' : defaultRole,
                                    password: 'password123'
                                });
                                setIsAddingUser(true);
                                setModalVisible(true);
                            }}
                        >
                            <span>➕</span> Add User
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="search-container">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search users by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {filter === 'responders' && (
                        <div className="filter-announcement">
                            <span>🛡️</span>
                            <span>Showing Field Responders only</span>
                            <span className="clear-filter-link" onClick={() => navigate('/manage-users')}>
                                Clear
                            </span>
                        </div>
                    )}

                    {/* Users List */}
                    <div className="users-list-container">
                        {isLoading && users.length === 0 ? (
                            <div style={{ textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>
                                Loading users...
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', gridColumn: '1/-1', padding: '40px', color: '#666' }}>
                                No users found.
                            </div>
                        ) : (
                            filteredUsers.map(u => {
                                const isResponder = ['police_responder', 'firefighter', 'ambulance_responder'].includes(u.role);
                                const isBusy = u.status === 'busy' || u.current_incident_id !== null;

                                return (
                                    <div key={u.id} className="user-card">
                                        <div className="user-info-main">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt={u.name} className="user-avatar-web" />
                                            ) : (
                                                <div className="user-avatar-placeholder">
                                                    {u.name?.substring(0, 2).toUpperCase() || '??'}
                                                </div>
                                            )}
                                            <div className="user-text-details">
                                                <div className="user-name-row">
                                                    <span className="user-name-text">{u.name || 'Unnamed User'}</span>
                                                    {isResponder && (
                                                        <div
                                                            className="status-dot"
                                                            style={{ backgroundColor: isBusy ? COLORS.status.error : COLORS.status.success }}
                                                        />
                                                    )}
                                                </div>
                                                <span className="user-email-text">{u.email}</span>
                                                <div className="badges-row">
                                                    <span
                                                        className="role-badge-web"
                                                        style={{
                                                            backgroundColor: getRoleColor(u.role) + '20',
                                                            color: getRoleColor(u.role)
                                                        }}
                                                    >
                                                        {u.role.replace(/_/g, ' ').toUpperCase()}
                                                    </span>
                                                    {isResponder && (
                                                        <span
                                                            className="availability-badge-web"
                                                            style={{
                                                                backgroundColor: isBusy ? COLORS.status.errorBg : COLORS.status.successBg,
                                                                color: isBusy ? COLORS.status.error : COLORS.status.success
                                                            }}
                                                        >
                                                            {isBusy ? 'BUSY' : 'AVAILABLE'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="card-actions-web">
                                            <button className="action-icon-btn edit" onClick={() => openModal(u)}>
                                                ✏️
                                            </button>
                                            <button className="action-icon-btn delete" onClick={() => handleDeleteUser(u)}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Modal */}
                    {modalVisible && (
                        <div className="modal-overlay-web" onClick={(e) => e.target === e.currentTarget && setModalVisible(false)}>
                            <div className="modal-content-web">
                                <h2 className="modal-title-web">{isAddingUser ? 'Add New User' : 'Edit User'}</h2>

                                {isAddingUser && (
                                    <>
                                        <div className="form-group-web">
                                            <label className="label-web">Full Name</label>
                                            <input
                                                className="input-web"
                                                value={newUserData.name}
                                                onChange={(e) => setNewUserData(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div className="form-group-web">
                                            <label className="label-web">Email Address</label>
                                            <input
                                                className="input-web"
                                                value={newUserData.email}
                                                onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                                                placeholder="user@example.com"
                                                autoCapitalize="none"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="form-group-web">
                                    <label className="label-web">Role</label>
                                    <div className="role-grid-web">
                                        {ROLES.map((role) => (
                                            <div
                                                key={role}
                                                className={`role-option-web ${(isAddingUser ? newUserData.role : formData.role) === role ? 'active' : ''}`}
                                                onClick={() => isAddingUser
                                                    ? setNewUserData(prev => ({
                                                        ...prev,
                                                        role,
                                                        station_id: (role !== 'user' && role !== 'admin') ? prev.station_id : null,
                                                        service_type: (role !== 'user' && role !== 'admin') ? prev.service_type : undefined
                                                    }))
                                                    : handleRoleChange(role)
                                                }
                                            >
                                                {role.replace(/_/g, ' ').replace('station', '').replace('responder', '')}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {isStationDependent && (
                                    <div className="form-group-web">
                                        <label className="label-web">Assign Station</label>
                                        <div className="station-list-web">
                                            {stations.map((s) => (
                                                <div
                                                    key={s.id}
                                                    className={`station-option-web ${(isAddingUser ? newUserData.station_id : formData.station_id) === s.id ? 'active' : ''}`}
                                                    onClick={() => isAddingUser
                                                        ? setNewUserData(prev => ({ ...prev, station_id: s.id, service_type: s.type }))
                                                        : handleStationChange(s)
                                                    }
                                                >
                                                    {s.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="modal-footer-web">
                                    <button
                                        className="footer-btn cancel"
                                        onClick={() => {
                                            setModalVisible(false);
                                            setIsAddingUser(false);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="footer-btn save"
                                        onClick={isAddingUser ? handleCreateUser : handleSave}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Processing...' : (isAddingUser ? 'Create User' : 'Save Changes')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ManageUsers;
