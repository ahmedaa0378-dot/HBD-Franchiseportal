import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface Franchise {
  id: string;
  franchise_name: string;
  owner_name: string;
  email: string;
  phone: string;
  site_location: string;
  city: string;
  omc_partner: string;
  status: string;
  created_at: string;
}

const FranchisesPage = () => {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchFranchises();
  }, []);

  const fetchFranchises = async () => {
    const { data } = await supabase
      .from('franchises')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setFranchises(data);
    setLoading(false);
  };

  const handleStatusChange = async (franchise: Franchise, newStatus: string, reason?: string) => {
    setActionLoading(true);
    
    const updateData: any = { 
      status: newStatus,
      ...(newStatus === 'approved' && { approved_at: new Date().toISOString() }),
      ...(newStatus === 'rejected' && reason && { rejection_reason: reason })
    };

    const { error } = await supabase
      .from('franchises')
      .update(updateData)
      .eq('id', franchise.id);

    if (!error) {
      setFranchises(prev => 
        prev.map(f => f.id === franchise.id ? { ...f, ...updateData } : f)
      );
      setShowModal(false);
      setSelectedFranchise(null);
    }
    
    setActionLoading(false);
  };

  const filteredFranchises = filter === 'all' 
    ? franchises 
    : franchises.filter(f => f.status === filter);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-gray-100 text-gray-800'
  };

  const statusCounts = {
    all: franchises.length,
    pending: franchises.filter(f => f.status === 'pending').length,
    approved: franchises.filter(f => f.status === 'approved').length,
    rejected: franchises.filter(f => f.status === 'rejected').length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-gold border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Franchises</h1>
        <p className="text-gray-600 mt-1">Manage franchise registrations and approvals</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === status
                ? 'bg-brand-black text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status as keyof typeof statusCounts]})
          </button>
        ))}
      </div>

      {/* Franchises Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredFranchises.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No franchises found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Franchise</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Owner</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Location</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">OMC</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFranchises.map(franchise => (
                  <tr key={franchise.id} className="border-t hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{franchise.franchise_name}</p>
                      <p className="text-xs text-gray-500">{franchise.email}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-gray-900">{franchise.owner_name}</p>
                      <p className="text-xs text-gray-500">{franchise.phone}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-gray-900">{franchise.site_location}</p>
                      <p className="text-xs text-gray-500">{franchise.city}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{franchise.omc_partner || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[franchise.status]}`}>
                        {franchise.status.charAt(0).toUpperCase() + franchise.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => { setSelectedFranchise(franchise); setShowModal(true); }}
                        className="text-brand-gold hover:underline text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedFranchise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Franchise Details</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Franchise Name</p>
                  <p className="font-medium">{selectedFranchise.franchise_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Owner</p>
                  <p className="font-medium">{selectedFranchise.owner_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{selectedFranchise.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{selectedFranchise.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Site Location</p>
                  <p className="font-medium">{selectedFranchise.site_location}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">City</p>
                  <p className="font-medium">{selectedFranchise.city}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">OMC Partner</p>
                  <p className="font-medium">{selectedFranchise.omc_partner || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[selectedFranchise.status]}`}>
                    {selectedFranchise.status.charAt(0).toUpperCase() + selectedFranchise.status.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="font-medium">
                    {new Date(selectedFranchise.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedFranchise.status === 'pending' && (
              <div className="p-6 border-t bg-gray-50 flex gap-3">
                <button
                  onClick={() => handleStatusChange(selectedFranchise, 'approved')}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : '✓ Approve'}
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Rejection reason (optional):');
                    handleStatusChange(selectedFranchise, 'rejected', reason || undefined);
                  }}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : '✕ Reject'}
                </button>
              </div>
            )}

            {selectedFranchise.status === 'approved' && (
              <div className="p-6 border-t bg-gray-50">
                <button
                  onClick={() => handleStatusChange(selectedFranchise, 'suspended')}
                  disabled={actionLoading}
                  className="w-full bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Suspend Franchise'}
                </button>
              </div>
            )}

            {selectedFranchise.status === 'suspended' && (
              <div className="p-6 border-t bg-gray-50">
                <button
                  onClick={() => handleStatusChange(selectedFranchise, 'approved')}
                  disabled={actionLoading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Reactivate Franchise'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default FranchisesPage;