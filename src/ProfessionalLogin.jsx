// src/ProfessionalLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import './ProfessionalLogin.css';

const ProfessionalLogin = () => {
    const navigate = useNavigate();
    const { loginProfessional } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            setError('Email and password are required');
            return;
        }

        try {
            setIsLoading(true);
            setError('');
            const user = await loginProfessional(email, password);

            if (user) {
                console.log('✅ Professional login successful, navigating...');
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('❌ LOGIN EXCEPTION:', error.message);
            setError(error.message || 'Invalid credentials or connection error.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="professional-login-container">
            <div className="login-gradient-bg">
                <div className="login-content-wrapper">
                    {/* Header with logo */}
                    <div className="header-container">
                        <div className="logo-title-container">
                            <img
                                src="/logo.png"
                                alt="ResQ Logo"
                                className="logo"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/120x120?text=ResQ';
                                }}
                            />
                            <h1 className="app-name">ResQ</h1>
                        </div>
                        <h2 className="subtitle">Station Admin Portal</h2>
                    </div>

                    {/* Form */}
                    <form className="form" onSubmit={handleLogin}>
                        {error && (
                            <div className="error-alert">
                                <span className="error-icon">⚠️</span>
                                {error}
                            </div>
                        )}

                        <div className="input-container">
                            <label className="label">Email</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="input-container">
                            <label className="label">Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={`login-button ${isLoading ? 'button-disabled' : ''}`}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="loading-spinner">⏳</span>
                            ) : (
                                'Login to Dashboard'
                            )}
                        </button>

                        <div className="info-container">
                            <p className="info-text">
                                This portal is restricted to authorized station personnel.
                                Login attempts are monitored.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalLogin;