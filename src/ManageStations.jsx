// src/ManageStations.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { COLORS } from './constants/colors';
import './ManageStations.css';

const ManageStations = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const isSuperAdmin = currentUser?.role === 'admin';
    const isStationAdmin = ['police_station', 'fire_station', 'ambulance_station'].includes(currentUser?.role || '');

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingStation, setEditingStation] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        type: 'police',
        contact_number: '',
        latitude: 0,
        longitude: 0,
        is_active: true,
    });

    useEffect(() => {
        fetchStations();
    }, []);

    const fetchStations = async () => {
        try {
            setIsLoading(true);
            let query = supabase.from('stations').select('*');

            if (isStationAdmin) {
                let serviceType = 'police';
                if (currentUser?.role === 'fire_station') serviceType = 'fire';
                if (currentUser?.role === 'ambulance_station') serviceType = 'ambulance';
                query = query.eq('type', serviceType);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;
            setStations(data || []);
        } catch (error) {
            console.error('Error fetching stations:', error);
            alert('Failed to load stations');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (!formData.name || !formData.address || !formData.contact_number) {
                alert('Please fill in all required fields');
                return;
            }

            setIsLoading(true);

            const stationData = {
                name: formData.name,
                type: formData.type,
                address: formData.address,
                contact_number: formData.contact_number,
                latitude: parseFloat(formData.latitude?.toString() || '0'),
                longitude: parseFloat(formData.longitude?.toString() || '0'),
                is_active: formData.is_active,
                updated_at: new Date().toISOString(),
            };

            if (editingStation) {
                const { error } = await supabase
                    .from('stations')
                    .update(stationData)
                    .eq('id', editingStation.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('stations')
                    .insert([{
                        ...stationData,
                        created_at: new Date().toISOString(),
                    }]);

                if (error) {
                    if (error.code === '23505') {
                        throw new Error('Database ID conflict. This usually resolves after a few tries or a refresh.');
                    }
                    throw error;
                }
            }

            setModalVisible(false);
            fetchStations();
            alert(`Station ${editingStation ? 'updated' : 'created'} successfully`);
        } catch (error) {
            console.error('Error saving station:', error);
            alert(error.message || 'Failed to save station');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (station) => {
        try {
            setIsLoading(true);
            const { count, error: countError } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('station_id', station.id);

            if (countError) throw countError;

            if (count && count > 0) {
                alert(`This station has ${count} assigned responders. You must re-assign or remove them before deleting this station.`);
                setIsLoading(false);
                return;
            }

            if (window.confirm(`Are you sure you want to delete ${station.name}? This action cannot be undone.`)) {
                const { error } = await supabase
                    .from('stations')
                    .delete()
                    .eq('id', station.id);

                if (error) throw error;
                fetchStations();
                alert('Station removed successfully');
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const openModal = (station = null) => {
        if (station) {
            setEditingStation(station);
            setFormData(station);
        } else {
            setEditingStation(null);
            setFormData({
                name: '',
                address: '',
                type: isStationAdmin ? (currentUser?.role.split('_')[0]) : 'police',
                contact_number: '',
                latitude: 14.5995,
                longitude: 120.9842,
                is_active: true,
            });
        }
        setModalVisible(true);
    };

    const filteredStations = stations.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStationColor = (type) => {
        switch (type) {
            case 'police': return COLORS.category.police;
            case 'fire': return COLORS.category.fire;
            case 'ambulance': return COLORS.category.ambulance;
            default: return COLORS.text.secondary;
        }
    };

    return (
        <div className="manage-stations-container">
            <div className="manage-stations-gradient-bg">
                <div className="manage-stations-content-wrapper">

                    {/* Header */}
                    <div className="manage-stations-header">
                        <div className="header-left-group">
                            <button className="back-btn" onClick={() => navigate(-1)}>
                                ⬅️
                            </button>
                            <h1 className="page-title">Manage Stations</h1>
                        </div>
                        {isSuperAdmin && (
                            <button className="add-station-header-btn" onClick={() => openModal()}>
                                <span>➕</span> Add Station
                            </button>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div className="search-container">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search stations by name or address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Stations Grid */}
                    <div className="stations-list-container">
                        {isLoading && stations.length === 0 ? (
                            <div style={{ textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>Loading stations...</div>
                        ) : filteredStations.length === 0 ? (
                            <div style={{ textAlign: 'center', gridColumn: '1/-1', padding: '40px', color: '#666' }}>No stations found.</div>
                        ) : (
                            filteredStations.map(item => (
                                <div key={item.id} className="station-card-web">
                                    <div className="type-strip-web" style={{ backgroundColor: getStationColor(item.type) }} />
                                    <div className="station-card-content-web">
                                        <div className="station-card-header-web">
                                            <div className="station-title-group-web">
                                                <span className="station-name-text-web">{item.name}</span>
                                                <div className="type-indicator-web" style={{ backgroundColor: getStationColor(item.type) + '15', color: getStationColor(item.type) }}>
                                                    {item.type.toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="status-badge-web" style={{
                                                backgroundColor: item.is_active ? COLORS.status.successBg : COLORS.background.gray,
                                                color: item.is_active ? COLORS.status.success : COLORS.text.secondary
                                            }}>
                                                {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </div>
                                        </div>

                                        <div className="station-details-web">
                                            <div className="detail-row-web">
                                                <span className="detail-icon-web">📍</span>
                                                <span className="station-address-web" title={item.address}>{item.address}</span>
                                            </div>
                                            <div className="detail-row-web">
                                                <span className="detail-icon-web">📞</span>
                                                <span className="station-contact-web">{item.contact_number}</span>
                                            </div>
                                        </div>

                                        <div className="station-card-actions-web">
                                            <button className="station-action-btn-web edit" onClick={() => openModal(item)}>
                                                ✏️ Edit
                                            </button>
                                            {isSuperAdmin && (
                                                <button className="station-action-btn-web delete" onClick={() => handleDelete(item)}>
                                                    🗑️ Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Modal */}
                    {modalVisible && (
                        <div className="modal-overlay-web" onClick={(e) => e.target === e.currentTarget && setModalVisible(false)}>
                            <div className="modal-content-web">
                                <h2 className="modal-title-web">{editingStation ? 'Edit Station' : 'Add Station'}</h2>

                                <div className="form-group-web">
                                    <label className="label-web">Name</label>
                                    <input
                                        className="input-web"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Station Name"
                                    />
                                </div>

                                <div className="form-group-web">
                                    <label className="label-web">Type</label>
                                    <div className="type-selector-web">
                                        {['police', 'fire', 'ambulance'].map((type) => (
                                            <button
                                                key={type}
                                                className={`type-option-btn-web ${formData.type === type ? 'active' : ''}`}
                                                style={formData.type === type ? { backgroundColor: getStationColor(type), borderColor: getStationColor(type) } : {}}
                                                onClick={() => setFormData({ ...formData, type })}
                                                disabled={isStationAdmin}
                                            >
                                                {type.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group-web">
                                    <label className="label-web">Address</label>
                                    <textarea
                                        className="input-web"
                                        style={{ minHeight: '80px', resize: 'vertical' }}
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Full Address"
                                    />
                                </div>

                                <div className="modal-row-web">
                                    <div className="form-group-web">
                                        <label className="label-web">Latitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input-web"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group-web">
                                        <label className="label-web">Longitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input-web"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group-web">
                                    <label className="label-web">Contact Number</label>
                                    <input
                                        className="input-web"
                                        value={formData.contact_number}
                                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                        placeholder="Phone Number"
                                    />
                                </div>

                                <div className="form-group-web" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <label htmlFor="is_active" className="label-web">Active Status</label>
                                </div>

                                <div className="modal-footer-web">
                                    <button className="footer-btn cancel" onClick={() => setModalVisible(false)}>Cancel</button>
                                    <button className="footer-btn save" onClick={handleSave} disabled={isLoading}>
                                        {isLoading ? 'Saving...' : 'Save Station'}
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

export default ManageStations;
