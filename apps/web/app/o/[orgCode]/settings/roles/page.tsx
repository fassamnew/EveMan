'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
}

export default function RolesPage() {
  const params = useParams();
  const { theme } = useTheme();
  const orgCode = params.orgCode as string;

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
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/organizations/org/${orgCode}/roles`);
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [orgCode]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setError('Role name is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await fetch(`/api/organizations/org/${orgCode}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || undefined
        })
      });

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
      const response = await fetch(`/api/organizations/org/${orgCode}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDesc.trim() })
      });

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
      const response = await fetch(`/api/organizations/org/${orgCode}/roles/${roleId}`, {
        method: 'DELETE'
      });

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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create New Role */}
      <Card className={theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}>
        <CardHeader>
          <CardTitle>Create New Role</CardTitle>
          <CardDescription>Add a new custom role to your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Role Name
              </label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g., Event Manager, Scanner Admin"
                disabled={creating}
                className={theme === 'dark' ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-300'}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Description (Optional)
              </label>
              <Input
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="What is this role for?"
                disabled={creating}
                className={theme === 'dark' ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-300'}
              />
            </div>
            <Button type="submit" disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Creating...' : 'Create Role'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Roles List */}
      <div className="space-y-4">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
          Available Roles
        </h2>

        <div className="grid gap-4">
          {roles.map((role) => (
            <Card
              key={role.id}
              className={theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}
            >
              <CardContent className="pt-6">
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
                          <Input
                            size={30}
                            value={editingDesc[role.id]}
                            onChange={(e) =>
                              setEditingDesc((prev) => ({
                                ...prev,
                                [role.id]: e.target.value
                              }))
                            }
                            placeholder="New description"
                            className={theme === 'dark' ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-300'}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleUpdateDescription(role.id, editingDesc[role.id])}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditingDesc((prev) => {
                                const updated = { ...prev };
                                delete updated[role.id];
                                return updated;
                              })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingDesc((prev) => ({ ...prev, [role.id]: role.description || '' }))}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteRole(role.id)}
                            disabled={deleting === role.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {roles.length === 0 && !loading && (
          <Card className={theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}>
            <CardContent className={`pt-6 text-center ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              No roles found. Create your first custom role above.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

