'use client';

import { FormEvent, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '../../../../../lib/theme-provider';
import { authFetch, loadSession } from '../../../../../lib/session';

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function RolesPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const orgCode = params.orgCode as string;
  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingDesc, setEditingDesc] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const session = loadSession();
      if (!session) {
        onSessionExpired();
        return;
      }
      setLoading(true);
      setError(null);
      const response = await authFetch(`${API_BASE}/org/${orgCode}/roles`, {}, onSessionExpired);
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, orgCode]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setError('Role name is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await authFetch(`${API_BASE}/org/${orgCode}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || undefined
        })
      }, onSessionExpired);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create role');
      }

      setNewRoleName('');
      setNewRoleDescription('');
      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateDescription = async (roleId: string, newDesc: string) => {
    try {
      const response = await authFetch(`${API_BASE}/org/${orgCode}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDesc.trim() })
      }, onSessionExpired);

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      setEditingDesc((prev) => {
        const updated = { ...prev };
        delete updated[roleId];
        return updated;
      });
      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;

    try {
      setDeleting(roleId);
      setError(null);
      const response = await authFetch(`${API_BASE}/org/${orgCode}/roles/${roleId}`, {
        method: 'DELETE'
      }, onSessionExpired);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to delete role');
      }

      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Loading roles...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
          Custom Roles
        </h1>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
          Create and manage custom user roles for your organization
        </p>
      </div>

      {error && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          theme === 'dark'
            ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
            : 'border-rose-300 bg-rose-100 text-rose-700'
        }`}>
          {error}
        </div>
      )}

      {/* Create New Role */}
      <section className={`rounded-xl border p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>Create New Role</h2>
        <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Add a new custom role to your organization</p>
        <div className="mt-4">
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Role Name
              </label>
              <input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g., Event Manager, Scanner Admin"
                disabled={creating}
                className={`w-full rounded-lg border px-3 py-2 ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Description (Optional)
              </label>
              <input
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="What is this role for?"
                disabled={creating}
                className={`w-full rounded-lg border px-3 py-2 ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'}`}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                theme === 'dark'
                  ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-60`}
            >
              +
              {creating ? 'Creating...' : 'Create Role'}
            </button>
          </form>
        </div>
      </section>

      {/* Roles List */}
      <div className="space-y-4">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
          Available Roles
        </h2>

        <div className="grid gap-4">
          {roles.map((role) => (
            <section
              key={role.id}
              className={`rounded-xl border p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}
            >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
                        {role.name}
                      </h3>
                      {role.isSystem && (
                        <span className={`px-2 py-1 text-xs rounded ${
                          theme === 'dark'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          System Role
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {role.description || 'No description'}
                    </p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                      Created: {new Date(role.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {!role.isSystem && (
                    <div className="flex gap-2">
                      {editingDesc[role.id] !== undefined ? (
                        <div className="flex gap-2">
                          <input
                            value={editingDesc[role.id]}
                            onChange={(e) =>
                              setEditingDesc((prev) => ({
                                ...prev,
                                [role.id]: e.target.value
                              }))
                            }
                            placeholder="New description"
                            className={`rounded-lg border px-3 py-2 text-sm ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'}`}
                          />
                          <button
                            onClick={() => handleUpdateDescription(role.id, editingDesc[role.id])}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              theme === 'dark'
                                ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            Save
                          </button>
                          <button
                            onClick={() =>
                              setEditingDesc((prev) => {
                                const updated = { ...prev };
                                delete updated[role.id];
                                return updated;
                              })
                            }
                            className={`rounded-lg border px-3 py-2 text-xs transition ${
                              theme === 'dark'
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingDesc((prev) => ({ ...prev, [role.id]: role.description || '' }))}
                            className={`rounded-lg border px-3 py-2 text-xs transition ${
                              theme === 'dark'
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.id)}
                            disabled={deleting === role.id}
                            className={`rounded-lg border px-3 py-2 text-xs transition ${
                              theme === 'dark'
                                ? 'border-rose-500/50 text-rose-200 hover:bg-rose-500/10'
                                : 'border-rose-300 text-rose-700 hover:bg-rose-100'
                            } disabled:opacity-60`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
            </section>
          ))}
        </div>

        {roles.length === 0 && !loading && (
          <section className={`rounded-xl border p-6 text-center ${theme === 'dark' ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              No roles found. Create your first custom role above.
          </section>
        )}
      </div>
    </div>
  );
}

