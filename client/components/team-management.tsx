'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Shield, Trash2, Mail, User as UserIcon, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

type Role = 'admin' | 'recruiter' | 'interviewer';

interface User {
	id: string;
	full_name: string;
	email: string;
	role: Role;
	last_logged_in_at?: string;
}

export default function TeamManagement({ currentUserId }: { currentUserId: string }) {
	const [users, setUsers] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');

	// Form State
	const [newEmail, setNewEmail] = useState('');
	const [newRole, setNewRole] = useState<Role>('interviewer');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const currentUser = users.find((u) => u.id === currentUserId);
	const canManageTeam = currentUser && ['admin', 'recruiter'].includes(currentUser.role);

	useEffect(() => {
		fetchUsers();
	}, []);

	const fetchUsers = async () => {
		try {
			const res = await api.get('/organizations/members');
			setUsers(res.data);
		} catch (err) {
			console.error('Failed to fetch members:', err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleAddUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		toast.promise(
			api.post('/organizations/members', {
				email: newEmail,
				role: newRole,
			}),
			{
				loading: 'Adding teammate...',
				success: () => {
					setIsAddModalOpen(false);
					setNewEmail('');
					setNewRole('interviewer');
					fetchUsers();
					return 'Teammate invited successfully';
				},
				error: (err) => err.response?.data?.error || 'Failed to add teammate',
				finally: () => setIsSubmitting(false),
			}
		);
	};

	const handleDeleteUser = async (id: string) => {
		if (!confirm('Are you sure you want to remove this member?')) return;

		toast.promise(api.delete(`/organizations/members/${id}`), {
			loading: 'Removing member...',
			success: () => {
				fetchUsers();
				return 'Member removed successfully';
			},
			error: (err) => err.response?.data?.error || 'Failed to remove member',
		});
	};

	const handleRoleChange = async (id: string, newRole: Role) => {
		toast.promise(api.put(`/organizations/members/${id}`, { role: newRole }), {
			loading: 'Updating permissions...',
			success: () => {
				setUsers(users.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
				return 'Permissions updated';
			},
			error: (err) => {
				fetchUsers();
				return err.response?.data?.error || 'Failed to update role';
			},
		});
	};

	const filteredUsers = users.filter(
		(user) =>
			(user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
			user.email.toLowerCase().includes(searchTerm.toLowerCase())
	);

	if (isLoading) {
		return (
			<div className='mt-8 py-12 flex justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-orange-500' />
			</div>
		);
	}

	return (
		<div className='mt-8 flex flex-col gap-6'>
			{/* Header Section */}
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h2 className='text-xl font-semibold text-white'>Organization Members</h2>
					<p className='mt-1 text-sm text-slate-400'>Manage your team, assign roles, and handle access permissions.</p>
				</div>
				{canManageTeam && (
					<button
						onClick={() => setIsAddModalOpen(true)}
						className='inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900'>
						<Plus className='mr-2 h-4 w-4' />
						Add Member
					</button>
				)}
			</div>

			{/* Search & Stats Bar */}
			<div className='flex flex-col gap-4 md:flex-row md:items-center'>
				<div className='relative flex-1'>
					<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
					<input
						type='text'
						placeholder='Search users by name or email...'
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className='w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
					/>
				</div>
				<div className='flex gap-3 text-sm'>
					<div className='rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300 border border-slate-700'>
						Total: <span className='font-semibold text-white'>{users.length}</span>
					</div>
				</div>
			</div>

			{/* Users List Grid */}
			<div className='grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3'>
				{filteredUsers.map((user) => (
					<div
						key={user.id}
						className='group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700 hover:bg-slate-800/50 hover:shadow-md'>
						<div className='flex items-start justify-between'>
							<div className='flex items-center gap-3'>
								<div className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700'>
									{(user.full_name || user.email).charAt(0).toUpperCase()}
								</div>
								<div>
									<h3 className='font-medium text-white group-hover:text-orange-400 transition-colors'>
										{user.full_name || 'No Name'}
									</h3>
									<div className='flex items-center gap-1.5 text-xs text-slate-500'>
										<Mail className='h-3 w-3' />
										{user.email}
									</div>
								</div>
							</div>

							{/* Role Select in Top Right */}
							<select
								value={user.role}
								onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
								className='bg-slate-800 border-none text-xs font-medium text-slate-300 rounded focus:ring-0 cursor-pointer pointer-events-auto z-10'
								onClick={(e) => e.stopPropagation()}>
								<option value='admin'>Admin</option>
								<option value='recruiter'>Recruiter</option>
								<option value='interviewer'>Interviewer</option>
							</select>
						</div>

						<div className='mt-6 flex items-center justify-between border-t border-slate-800 pt-4'>
							<div className='flex items-center gap-2'>
								<span className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 border border-slate-700'>
									<Shield className='mr-1.5 h-3 w-3 text-orange-500' />
									{user.role.charAt(0).toUpperCase() + user.role.slice(1)}
								</span>
							</div>

							{user.id !== currentUserId && (
								<button
									onClick={() => handleDeleteUser(user.id)}
									className='rounded p-1.5 text-slate-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100'
									title='Remove user'>
									<Trash2 className='h-4 w-4' />
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Add User Modal */}
			{isAddModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
					<div className='w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200'>
						<div className='relative border-b border-slate-800 p-6'>
							<h3 className='text-lg font-semibold text-white'>Add New Member</h3>
							<p className='mt-1 text-sm text-slate-400'>Add an existing user to your organization by email.</p>
							<button
								onClick={() => setIsAddModalOpen(false)}
								className='absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors'>
								<X className='h-5 w-5' />
							</button>
						</div>

						<form
							onSubmit={handleAddUser}
							className='p-6 space-y-4'>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-300'>Email Address</label>
								<div className='relative'>
									<Mail className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
									<input
										type='email'
										required
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
										className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
										placeholder='john@example.com'
									/>
								</div>
							</div>

							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-300'>Role</label>
								<div className='grid grid-cols-3 gap-3'>
									{(['recruiter', 'interviewer', 'admin'] as const).map((role) => (
										<label
											key={role}
											className={`
                                                cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-all
                                                ${
																									newRole === role
																										? 'bg-orange-600 border-orange-600 text-white shadow-md'
																										: 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
																								}
                                            `}>
											<input
												type='radio'
												name='role'
												value={role}
												checked={newRole === role}
												onChange={(e) => setNewRole(e.target.value as Role)}
												className='sr-only'
											/>
											{role.charAt(0).toUpperCase() + role.slice(1)}
										</label>
									))}
								</div>
							</div>

							<div className='mt-6 flex justify-end gap-3 pt-2'>
								<button
									type='button'
									onClick={() => setIsAddModalOpen(false)}
									className='rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors'>
									Cancel
								</button>
								<button
									type='submit'
									disabled={isSubmitting}
									className='rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50'>
									{isSubmitting ? 'Adding...' : 'Add Member'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
