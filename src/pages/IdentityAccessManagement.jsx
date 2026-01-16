import React, { useState } from 'react';
import AccessRequestsPage from './AccessRequestsPage';
import UserProfileManagementPage from './UserProfileManagementPage';

const IdentityAccessManagement = () => {
  const [activeTab, setActiveTab] = useState('profiles');

  return (
    <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
          <h1 className="text-3xl font-bold text-gray-900">Identity &amp; Access Management</h1>
          <p className="text-gray-600">Admin view limited to user profiles and access requests.</p>
              </div>
        <div className="inline-flex rounded-lg border overflow-hidden bg-white shadow-sm">
          <button
            className={`px-4 py-2 text-sm ${activeTab === 'profiles' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
            onClick={() => setActiveTab('profiles')}
          >
            User Profiles
          </button>
                      <button 
            className={`px-4 py-2 text-sm ${activeTab === 'requests' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
            onClick={() => setActiveTab('requests')}
          >
            Access Requests
                      </button>
                    </div>
            </div>

      {activeTab === 'profiles' ? <UserProfileManagementPage /> : <AccessRequestsPage />}
    </div>
  );
};

export default IdentityAccessManagement;








