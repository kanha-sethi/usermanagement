import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserList from './UserManagement/UserList';
import AddUserForm from './UserManagement/AddUserForm';
import EditUserForm from './UserManagement/EditUserForm';
import { LogOut, UserPlus, Settings } from 'lucide-react';
import axios from 'axios';

const Dashboard = () => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const userListRef = React.useRef();
  const navigate = useNavigate();

  const handleUserAdded = () => {
    if (userListRef.current) {
      userListRef.current.refreshUsers();
    }
  };

  const handleUserUpdated = () => {
    if (userListRef.current) {
      userListRef.current.refreshUsers();
    }
  };

  const handleEditUser = (id) => {
    setEditUserId(id);
    setShowEditUser(true);
  };

  const handleViewProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setProfileData(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">User Management System</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </button>
             
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <UserList ref={userListRef} onEdit={handleEditUser} />
        </div>
      </main>

      {showAddUser && <AddUserForm onUserAdded={handleUserAdded} setShowAddUser={setShowAddUser} />}
      {showEditUser && <EditUserForm userId={editUserId} onUserUpdated={handleUserUpdated} setShowEditUser={setShowEditUser} />}
    </div>
  );
};

export default Dashboard;
