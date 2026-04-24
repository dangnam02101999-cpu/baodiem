import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import LoginView from './views/LoginView';
import RoleSelectionView from './views/RoleSelectionView';
import TargetReporterView from './views/TargetReporterView';
import ClerkView from './views/ClerkView';
import ResultsView from './views/ResultsView';
import ManagementView from './views/ManagementView';
import CalibrationView from './views/CalibrationView';
import { Role } from './types';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { initAudio } from './lib/audio';

export default function App() {
  const [currentTab, setCurrentTab] = useState('LOGIN');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'ADMIN' | 'USER' | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      // Remove listener after first interaction
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Simple role mapping based on email or custom logic
        // For now, we'll use the username from the previous logic
        // In a real app, we'd check custom claims or a users collection
        setIsLoggedIn(true);
        // Default to USER if logged in via Firebase
        if (!userRole) setUserRole('USER');
        if (currentTab === 'LOGIN') setCurrentTab('ROLE');
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
        setSelectedRole(null);
        setCurrentTab('LOGIN');
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [userRole, currentTab]);

  const handleLogin = (role: 'ADMIN' | 'USER') => {
    setUserRole(role);
    setIsLoggedIn(true);
    if (role === 'ADMIN') {
      setCurrentTab('MANAGE');
    } else {
      setCurrentTab('ROLE');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    if (role === 'REPORTER') setCurrentTab('TARGET');
    else if (role === 'SECRETARY') setCurrentTab('CLERK');
    else if (role === 'VIEWER') setCurrentTab('RESULT');
    else if (role === 'CALIBRATION') setCurrentTab('CALIBRATION');
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'LOGIN':
        return <LoginView onLogin={handleLogin} />;
      case 'ROLE':
        return <RoleSelectionView onSelectRole={handleSelectRole} />;
      case 'TARGET':
        return <TargetReporterView />;
      case 'CLERK':
        return <ClerkView />;
      case 'RESULT':
        return <ResultsView />;
      case 'MANAGE':
        return <ManagementView />;
      case 'CALIBRATION':
        return <CalibrationView />;
      default:
        return <LoginView onLogin={handleLogin} />;
    }
  };

  const getTitle = () => {
    switch (currentTab) {
      case 'LOGIN': return 'PHẦN MỀM BÁO BIA';
      case 'ROLE': return 'CHỌN VAI TRÒ';
      case 'TARGET': return 'BÁO BIA';
      case 'CLERK': return 'THƯ KÍ';
      case 'RESULT': return 'KẾT QUẢ';
      case 'MANAGE': return 'QUẢN LÝ DANH SÁCH';
      case 'CALIBRATION': return 'BẮN HIỆU CHỈNH';
      default: return 'PHẦN MỀM BÁO BIA';
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-tactical-green">
        <div className="w-12 h-12 border-4 border-tactical-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Layout 
      title={getTitle()} 
      activeTab={currentTab} 
      onTabChange={(tab) => {
        // Restrict navigation based on role and selected role
        if (userRole === 'ADMIN') {
          if (['MANAGE', 'RESULT'].includes(tab)) setCurrentTab(tab);
        } else if (userRole === 'USER') {
          // If a role is selected, restrict to that role's view and Results
          if (selectedRole === 'REPORTER') {
            if (['TARGET', 'RESULT'].includes(tab)) setCurrentTab(tab);
          } else if (selectedRole === 'SECRETARY') {
            if (['CLERK', 'RESULT'].includes(tab)) setCurrentTab(tab);
          } else if (selectedRole === 'VIEWER') {
            if (['RESULT'].includes(tab)) setCurrentTab(tab);
          } else if (selectedRole === 'CALIBRATION') {
            if (['CALIBRATION', 'RESULT'].includes(tab)) setCurrentTab(tab);
          } else {
            // No role selected yet (at ROLE screen)
            if (tab === 'ROLE') setCurrentTab(tab);
          }
        }
      }}
      showNav={isLoggedIn && currentTab !== 'ROLE'}
      userRole={userRole}
      selectedRole={selectedRole}
      onLogout={handleLogout}
    >
      {renderContent()}
      <Toaster position="top-center" />
    </Layout>
  );
}
