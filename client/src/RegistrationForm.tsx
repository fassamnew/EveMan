import React, { useState } from 'react';

const RegistrationForm: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    designation: '',
    company: '',
    email: '',
    phone: '',
    category: 'Delegate'
  });
  const [status, setStatus] = useState({ message: '', type: '' });
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ message: 'Processing your registration...', type: 'info' });
    setBadgeUrl(null);
    try {
      const response = await fetch('http://localhost:5001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({ message: 'Registration Successful! Your badge has been sent to your email.', type: 'success' });
        setBadgeUrl(data.badgeUrl);
        setFormData({ fullName: '', designation: '', company: '', email: '', phone: '', category: 'Delegate' });
      } else {
        setStatus({ message: data.error || 'Error occurred. Please check your details and try again.', type: 'error' });
      }
    } catch (err) {
      setStatus({ message: 'Could not connect to the registration server.', type: 'error' });
    }
  };

  const inputStyle = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-gray-50/50";
  const labelStyle = "block text-sm font-semibold text-gray-700 mb-1.5 ml-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl shadow-blue-900/5 p-8 md:p-12">
        <div className="text-center mb-10">
          <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 leading-tight">Join the Event</h2>
          <p className="text-gray-500 mt-2">Fill in your details to secure your spot at NH Event 2026</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelStyle}>Full Name</label>
              <input 
                className={inputStyle} 
                type="text" 
                placeholder="John Doe"
                required 
                value={formData.fullName} 
                onChange={e => setFormData({...formData, fullName: e.target.value})} 
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelStyle}>Email Address</label>
              <input 
                className={inputStyle} 
                type="email" 
                placeholder="john@example.com"
                required 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
              />
            </div>

            <div>
              <label className={labelStyle}>Company</label>
              <input 
                className={inputStyle} 
                type="text" 
                placeholder="Google"
                value={formData.company} 
                onChange={e => setFormData({...formData, company: e.target.value})} 
              />
            </div>

            <div>
              <label className={labelStyle}>Designation</label>
              <input 
                className={inputStyle} 
                type="text" 
                placeholder="Manager"
                value={formData.designation} 
                onChange={e => setFormData({...formData, designation: e.target.value})} 
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelStyle}>Attendee Category</label>
              <select 
                className={inputStyle + " appearance-none"} 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="Delegate">Delegate</option>
                <option value="Media">Media</option>
                <option value="Sponsor">Sponsor</option>
                <option value="Speaker">Speaker</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] mt-4"
          >
            Register Now
          </button>
        </form>

        {status.message && (
          <div className={`mt-8 p-4 rounded-xl text-center text-sm font-medium ${
            status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 
            status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 
            'bg-blue-50 text-blue-700 border border-blue-100'
          }`}>
            {status.message}
          </div>
        )}

        {badgeUrl && (
          <div className="mt-8 border-t border-gray-100 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Your Event Badge</h3>
            <div className="bg-gray-100 rounded-2xl p-4 mb-4 flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner">
               <iframe src={badgeUrl} className="w-full h-64 rounded-lg bg-white" title="Badge Preview"></iframe>
            </div>
            <a 
              href={badgeUrl} 
              download 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 bg-secondary hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF Badge
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationForm;