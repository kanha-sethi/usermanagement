import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserList = React.forwardRef((props, ref) => {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('');
    const [order, setOrder] = useState('ASC');

    useEffect(() => {
        fetchUsers();
    }, [search, sortBy, order]);

    React.useImperativeHandle(ref, () => ({
        refreshUsers: fetchUsers
    }));

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `http://localhost:5000/api/users?search=${search}&sortBy=${sortBy}&order=${order}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleEdit = (id) => {
        props.onEdit(id); // Call the onEdit function passed from the parent component
    };

    return (
        <div className="p-8">
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search users..."
                    className="px-3 py-2 border rounded"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <table className="min-w-full bg-white">
                <thead>
                    <tr>
                        <th
                            className="px-6 py-3 border-b text-center cursor-pointer"
                            onClick={() => {
                                setSortBy('name');
                                setOrder(order === 'ASC' ? 'DESC' : 'ASC');
                            }}
                        >
                            Name
                        </th>
                        <th
                            className="px-6 py-3 border-b text-center cursor-pointer"
                            onClick={() => {
                                setSortBy('dob');
                                setOrder(order === 'ASC' ? 'DESC' : 'ASC');
                            }}
                        >
                            Date of Birth
                        </th>
                        <th className="px-6 py-3 border-b text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-6 py-4 border-b text-center">
                                <div className="flex items-center justify-center">
                                    {user.profile_image && (
                                        <img
                                            src={`http://localhost:5000${user.profile_image}`}
                                            alt="Profile"
                                            className="w-10 h-10 rounded-full mr-3"
                                        />
                                    )}
                                    {user.name}
                                </div>
                            </td>
                            <td className="px-6 py-4 border-b text-center">
                                {new Date(user.dob).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 border-b text-center">
                                <button
                                    onClick={() => handleEdit(user.id)}
                                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(user.id)}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 ml-2"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

export default UserList;
