"use client";

import { useState, useEffect } from 'react';
import { FaUser, FaUserSlash, FaUserCheck, FaSearch, FaFilter, FaPlus, FaTrash} from 'react-icons/fa';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface NewUser {
  name: string;
  email: string;
  password: string;
  role: 'superadmin' | 'admin' | 'admin_pembelajaran' | 'user';
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'activate' | 'deactivate' | 'delete'>('deactivate');
  
  // New user modal state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState<NewUser>({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  useEffect(() => {
    // Guard: only SuperAdmin can access users management
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return; // layout will redirect
      const current = JSON.parse(userData);
      if (current.role !== 'superadmin') {
        window.location.href = '/admin';
        return;
      }
    } catch {}
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchTerm, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(user => user.isActive === isActive);
    }

    setFilteredUsers(filtered);
  };

  const handleToggleUserStatus = (user: User, action: 'activate' | 'deactivate') => {
    setSelectedUser(user);
    setActionType(action);
    setShowConfirmModal(true);
  };

  // Delete user action
const handleDeleteUser = (user: User) => {
  setSelectedUser(user);
  setActionType('delete');
  setShowConfirmModal(true);
};
  const confirmToggleStatus = async () => {
    if (!selectedUser) return;
  
    try {
      if (actionType === 'delete') {
        const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
          setShowConfirmModal(false);
          setSelectedUser(null);
        } else {
          console.error('Failed to delete user');
        }
        return;
      }
  
      // existing PATCH toggle-status below (tetap dipertahankan)
      const response = await fetch(`/api/admin/users/${selectedUser.id}/toggle-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: actionType === 'activate' }),
      });
  
      if (response.ok) {
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.id === selectedUser.id ? { ...user, isActive: actionType === 'activate' } : user
          )
        );
        setShowConfirmModal(false);
        setSelectedUser(null);
      } else {
        console.error('Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateMessage(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (response.ok) {
        setCreateMessage('User berhasil dibuat!');
        setNewUser({ name: '', email: '', password: '', role: 'user' });
        setShowAddUserModal(false);
        fetchUsers(); // Refresh user list
      } else {
        setCreateMessage(data.error || 'Gagal membuat user');
      }
    } catch {
      setCreateMessage('Terjadi kesalahan saat membuat user');
    } finally {
      setCreatingUser(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Akun</h1>
          <p className="text-gray-600">Kelola akun pengguna sistem SPMT</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Pengguna</p>
            <p className="text-2xl font-bold text-blue-600">{users.length}</p>
          </div>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <FaPlus />
            <span>Tambah User</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="all">Semua Role</option>
            <option value="superadmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="admin_pembelajaran">Admin Pembelajaran</option>
            <option value="user">User</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <FaFilter />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pengguna
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dibuat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Login Terakhir
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <FaUser className="text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'superadmin'
                        ? 'bg-red-100 text-red-800'
                        : user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'admin_pembelajaran'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'superadmin'
                        ? 'Super Admin'
                        : user.role === 'admin'
                        ? 'Admin'
                        : user.role === 'admin_pembelajaran'
                        ? 'Admin Pembelajaran'
                        : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLogin ? formatDate(user.lastLogin) : 'Belum pernah login'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  {user.isActive ? (
    <div className="flex items-center gap-4">
      <button
        onClick={() => handleToggleUserStatus(user, 'deactivate')}
        className="text-red-600 hover:text-red-900 flex items-center space-x-1"
      >
        <FaUserSlash />
        <span>Nonaktifkan</span>
      </button>
      <button
        onClick={() => handleDeleteUser(user)}
        className="text-gray-600 hover:text-gray-900 flex items-center space-x-1"
      >
        <FaTrash />
        <span>Hapus</span>
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-4">
      <button
        onClick={() => handleToggleUserStatus(user, 'activate')}
        className="text-green-600 hover:text-green-900 flex items-center space-x-1"
      >
        <FaUserCheck />
        <span>Aktifkan</span>
      </button>
      <button
        onClick={() => handleDeleteUser(user)}
        className="text-gray-600 hover:text-gray-900 flex items-center space-x-1"
      >
        <FaTrash />
        <span>Hapus</span>
      </button>
    </div>
  )}
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <FaUser className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada pengguna</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Coba ubah filter pencarian Anda.'
                : 'Belum ada pengguna terdaftar.'}
            </p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none overflow-y-auto">
          <div className="mx-auto p-5 border w-96 shadow-lg rounded-md bg-white pointer-events-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Tambah User Baru</h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="user@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as NewUser['role']})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="user">User</option>
                    <option value="admin_pembelajaran">Admin Pembelajaran</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>

                {createMessage && (
                  <div className={`p-3 rounded-md text-sm ${
                    createMessage.includes('berhasil') 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    {createMessage}
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {creatingUser ? 'Membuat...' : 'Buat User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {/* Confirmation Modal */}
{showConfirmModal && selectedUser && (
  <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none overflow-y-auto">
    <div className="mx-auto p-6 w-full max-w-md shadow-xl rounded-lg bg-white pointer-events-auto">
      <div className="text-center">
        {/* Icon */}
        <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full
          ${actionType === 'activate' 
            ? 'bg-green-100' 
            : actionType === 'deactivate' 
            ? 'bg-yellow-100' 
            : 'bg-red-100'}
        `}>
          {actionType === 'activate' && <FaUserCheck className="h-6 w-6 text-green-600" />}
          {actionType === 'deactivate' && <FaUserSlash className="h-6 w-6 text-yellow-600" />}
          {actionType === 'delete' && <FaTrash className="h-6 w-6 text-red-600" />}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mt-4">
          {actionType === 'activate'
            ? 'Aktifkan Akun'
            : actionType === 'deactivate'
            ? 'Nonaktifkan Akun'
            : 'Hapus Akun'}
        </h3>

        {/* Message */}
        <div className="mt-3 px-4">
          <p className="text-sm text-gray-600">
            {actionType === 'delete' ? (
              <>Apakah Anda yakin ingin <span className="font-medium text-red-600">menghapus</span> akun <span className="font-medium">{selectedUser.name}</span>?<br />Tindakan ini tidak dapat dibatalkan.</>
            ) : (
              <>Apakah Anda yakin ingin {actionType === 'activate' ? 'mengaktifkan' : 'menonaktifkan'} akun <span className="font-medium">{selectedUser.name}</span>?</>
            )}
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={confirmToggleStatus}
            className={`flex-1 px-4 py-2 rounded-md text-white font-medium shadow-sm transition-colors focus:outline-none focus:ring-2
              ${actionType === 'activate'
                ? 'bg-green-500 hover:bg-green-600 focus:ring-green-300'
                : actionType === 'deactivate'
                ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300'
                : 'bg-red-500 hover:bg-red-600 focus:ring-red-300'}
            `}
          >
            {actionType === 'activate'
              ? 'Aktifkan'
              : actionType === 'deactivate'
              ? 'Nonaktifkan'
              : 'Hapus'}
          </button>
          <button
            onClick={() => setShowConfirmModal(false)}
            className="flex-1 px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-300 transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
}


