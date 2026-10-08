import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './hooks/useToast';
import ToastContainer from './components/Toast/Toast';
import Navbar from './components/Navbar/Navbar';

import LandingPage from './pages/LandingPage/LandingPage';
import CreateGroupPage from './pages/CreateGroupPage/CreateGroupPage';
import JoinGroupPage from './pages/JoinGroupPage/JoinGroupPage';
import ExistingGroupsPage from './pages/ExistingGroupsPage/ExistingGroupsPage';
import GroupDashboardPage from './pages/GroupDashboardPage/GroupDashboardPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <UserProvider>
        <ToastProvider>
          <BrowserRouter>
            <Navbar />
            <main className="min-h-[calc(100vh-72px)]">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/create-group" element={<CreateGroupPage />} />
                <Route path="/join" element={<JoinGroupPage />} />
                <Route path="/join/:inviteCode" element={<JoinGroupPage />} />
                <Route path="/groups" element={<ExistingGroupsPage />} />
                <Route path="/groups/:groupId" element={<GroupDashboardPage />} />
              </Routes>
            </main>
            <ToastContainer />
          </BrowserRouter>
        </ToastProvider>
      </UserProvider>
    </ThemeProvider>
  </React.StrictMode>
);
