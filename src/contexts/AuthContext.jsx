
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, professionalAuthService } from '../supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authType, setAuthType] = useState(null);

  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('professional_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setAuthType('professional');
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const loginProfessional = async (email, password) => {
    try {
      setIsLoading(true);
      
      const { profile } = await professionalAuthService.signIn(email, password);
      
      
      const userData = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        station_id: profile.station_id,
        station: profile.stations,
        service_type: profile.service_type,
        avatar_url: profile.avatar_url,
        status: profile.status || 'available'
      };

      
      setUser(userData);
      setAuthType('professional');
      localStorage.setItem('professional_user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    setAuthType(null);
    localStorage.removeItem('professional_user');
  };

  const value = {
    user,
    isLoading,
    authType,
    isAuthenticated: !!user,
    loginProfessional,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};