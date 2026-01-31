'use client';

import { useState } from 'react';
import { Plus, Search, Shield, Trash2, Mail, User as UserIcon, X, Check } from 'lucide-react';

type Role = 'admin' | 'recruiter' | 'interviewer';

interface User {
	id: string;
	name: string;
	email: string;
	role: Role;
	status: 'active' | 'pending';
	lastActive?: string;
}

const MOCK_USERS: User[] = [
	{
		id: '1',
		name: 'Alex Johnson',
		email: 'alex@acme.inc',
		role: 'admin',
		status: 'active',
		lastActive: '2 mins ago',
	},
	{
		id: '2',
		name: 'Sarah Smith',
		email: 'sarah@acme.inc',
		role: 'recruiter',
		status: 'active',
		lastActive: '1 hour ago',
	},
	{
		id: '3',
		name: 'Mike Chen',
		email: 'mike@acme.inc',
		role: 'interviewer',
		status: 'pending',
	},
];

export default function TeamManagement() {
	const [users, setUsers] = useState<User[]>(MOCK_USERS);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');

	// Form State
	const [newName, setNewName] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [newRole, setNewRole] = useState<Role>('interviewer');

	const handleAddUser = (e: React.FormEvent) => {
		e.preventDefault();
		const newUser: User = {
			id: Math.random().toString(36).substr(2, 9),
			name: newName,
			email: newEmail,
			role: newRole,
			status: 'pending', // Default to pending until they join
		};
		setUsers([...users, newUser]);
		setIsAddModalOpen(false);
		setNewName('');
		setNewEmail('');
		setNewRole('interviewer');
	};

	const handleDeleteUser = (id: string) => {
		setUsers(users.filter((user) => user.id !== id));
	};

	const filteredUsers = users.filter(
		(user) =>
			user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.email.toLowerCase().includes(searchTerm.toLowerCase())
	);

	return (
		<div className='mt-8 flex flex-col gap-6'>
			{/* Header Section */}
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h2 className='text-xl font-semibold text-white'>Organization Members</h2>
					<p className='mt-1 text-sm text-slate-400'>Manage your team, assign roles, and handle access permissions.</p>
				</div>
				<button
					onClick={() => setIsAddModalOpen(true)}
					className='inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900'>
					<Plus className='mr-2 h-4 w-4' />
					Add Member
				</button>
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
					<div className='rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-500 border border-emerald-500/20'>
						Active: <span className='font-semibold'>{users.filter((u) => u.status === 'active').length}</span>
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
									{user.name.charAt(0).toUpperCase()}
								</div>
								<div>
									<h3 className='font-medium text-white group-hover:text-orange-400 transition-colors'>{user.name}</h3>
									<div className='flex items-center gap-1.5 text-xs text-slate-500'>
										<Mail className='h-3 w-3' />
										{user.email}
									</div>
								</div>
							</div>
							<div
								className={`
                                px-2 py-1 rounded-full text-xs font-medium border
                                ${
																	user.status === 'active'
																		? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
																		: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
																}
                            `}>
								{user.status.charAt(0).toUpperCase() + user.status.slice(1)}
							</div>
						</div>

						<div className='mt-6 flex items-center justify-between border-t border-slate-800 pt-4'>
							<div className='flex items-center gap-2'>
								<span className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 border border-slate-700'>
									<Shield className='mr-1.5 h-3 w-3 text-orange-500' />
									{user.role.charAt(0).toUpperCase() + user.role.slice(1)}
								</span>
							</div>

							<button
								onClick={() => handleDeleteUser(user.id)}
								className='rounded p-1.5 text-slate-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100'
								title='Remove user'>
								<Trash2 className='h-4 w-4' />
							</button>
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
							<p className='mt-1 text-sm text-slate-400'>Invite a team member to join your organization.</p>
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
								<label className='text-sm font-medium text-slate-300'>Full Name</label>
								<div className='relative'>
									<UserIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
									<input
										type='text'
										required
										value={newName}
										onChange={(e) => setNewName(e.target.value)}
										className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
										placeholder='e.g., John Doe'
									/>
								</div>
							</div>

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
									className='rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
									Send Invite
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
