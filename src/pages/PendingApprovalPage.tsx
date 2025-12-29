import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';

const PendingApprovalPage = () => {
  const { franchise, signOut } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-cream">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">Approval Pending</h2>
        <p className="text-gray-600 mb-2">
          Hi <strong>{franchise?.owner_name}</strong>,
        </p>
        <p className="text-gray-600 mb-6">
          Your franchise registration for <strong>{franchise?.franchise_name}</strong> is under review. 
          You'll receive an email once approved.
        </p>
        <div className="bg-brand-cream rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-gray-600">
            <strong>Location:</strong> {franchise?.site_location}<br/>
            <strong>City:</strong> {franchise?.city}
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-gray-500 hover:text-gray-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalPage;