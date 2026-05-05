import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Plus, Link as LinkIcon, Settings, Trash2, Globe, Palette } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
}

interface RegistrationLink {
  id: string;
  slug: string;
  label: string;
  themeColor: string;
}

const EventsManager: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  // New Event Form
  const [newEvent, setNewEvent] = useState({ name: '', date: '', location: '', description: '', startDate: '', endDate: '' });
  // New Link Form
  const [newLink, setNewLink] = useState({ label: '', slug: '', themeColor: '#003366', requiresApproval: 0, category: 'General' });

  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/events', authHeader);
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to fetch events');
    }
  };

  const fetchLinks = async (eventId: string) => {
    try {
      const res = await axios.get(`http://localhost:5001/api/events/${eventId}/links`, authHeader);
      setLinks(res.data);
    } catch (err) {
      console.error('Failed to fetch links');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Map local form fields to backend expected fields
      const payload = {
        name: newEvent.name,
        location: newEvent.location,
        description: newEvent.description || newEvent.name,
        startDate: newEvent.date,
        endDate: newEvent.date
      };
      await axios.post('http://localhost:5001/api/events', payload, authHeader);
      setShowEventModal(false);
      fetchEvents();
      setNewEvent({ name: '', date: '', location: '', description: '', startDate: '', endDate: '' });
    } catch (err) {
      alert('Failed to create event');
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      // Ensure category is present for the backend
      const payload = {
        ...newLink,
        category: newLink.category || 'General'
      };
      await axios.post(`http://localhost:5001/api/events/${selectedEvent.id}/links`, payload, authHeader);
      setShowLinkModal(false);
      fetchLinks(selectedEvent.id);
      setNewLink({ label: '', slug: '', themeColor: '#003366', requiresApproval: 0, category: 'General' });
    } catch (err) {
      alert('Failed to create registration link');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Manage Events</h1>
          <p className="text-gray-500">Create events and registration paths</p>
        </div>
        <button 
          onClick={() => setShowEventModal(true)}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="w-5 h-5" /> New Event
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Events List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">Your Events</h2>
          {events.map((event) => (
            <div 
              key={event.id}
              onClick={() => {
                setSelectedEvent(event);
                fetchLinks(event.id);
              }}
              className={`p-5 rounded-3xl cursor-pointer transition-all border ${
                selectedEvent?.id === event.id 
                  ? 'bg-white border-primary shadow-xl shadow-blue-500/10 scale-[1.02]' 
                  : 'bg-white border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${selectedEvent?.id === event.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{event.name}</h3>
                  <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Event Details & Links */}
        <div className="lg:col-span-2">
          {selectedEvent ? (
            <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-4xl font-black text-gray-900">{selectedEvent.name}</h2>
                  <p className="text-gray-500 flex items-center gap-2 mt-2">
                    <Globe className="w-4 h-4" /> {selectedEvent.location}
                  </p>
                </div>
                <div className="flex gap-2">
                   <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
                     <Settings className="w-5 h-5" />
                   </button>
                   <button className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                     <Trash2 className="w-5 h-5" />
                   </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-primary" /> Registration Links
                  </h3>
                  <button 
                    onClick={() => setShowLinkModal(true)}
                    className="text-primary hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    + Add Link
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {links.map((link) => (
                    <div key={link.id} className="p-6 rounded-3xl border border-gray-100 hover:border-primary/30 transition-all group">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: link.themeColor }}></div>
                        <h4 className="font-bold text-gray-900">{link.label}</h4>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between text-xs font-mono text-gray-500">
                        <span>/register/{link.slug}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/register/${link.slug}`);
                            alert('Link copied!');
                          }}
                          className="text-primary hover:underline font-bold"
                        >
                          COPY
                        </button>
                      </div>
                    </div>
                  ))}
                  {links.length === 0 && (
                    <div className="col-span-2 text-center py-10 text-gray-400 border-2 border-dashed border-gray-50 rounded-3xl">
                      No registration links created yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-20 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
              <Calendar className="w-16 h-16 opacity-20" />
              <p className="font-medium">Select an event to manage settings and links</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals could be implemented here as separate components or conditional renders */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Create New Event</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Event Name</label>
                <input 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="e.g. Annual Tech Summit 2026"
                  required
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Date</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                      required
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
                    <input 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                      placeholder="City, Hall"
                      required
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                    />
                 </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 font-bold bg-primary text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all">Create Event</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 mb-6">New Registration Link</h2>
            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Label (Public Facing)</label>
                <input 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="e.g. Speaker Registration"
                  required
                  value={newLink.label}
                  onChange={(e) => setNewLink({...newLink, label: e.target.value, slug: e.target.value.toLowerCase().replace(/ /g, '-')})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Category (Internal)</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                  value={newLink.category}
                  onChange={(e) => setNewLink({...newLink, category: e.target.value})}
                >
                  <option value="General">General</option>
                  <option value="VIP">VIP</option>
                  <option value="Speaker">Speaker</option>
                  <option value="Sponsor">Sponsor</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">URL Slug</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                  <span className="px-3 text-gray-400 text-sm font-mono tracking-tighter">/register/</span>
                  <input 
                    className="flex-1 py-3 bg-transparent outline-none font-mono text-sm"
                    required
                    value={newLink.slug}
                    onChange={(e) => setNewLink({...newLink, slug: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Theme Color
                </label>
                <div className="flex flex-wrap gap-3">
                  {['#003366', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewLink({...newLink, themeColor: color})}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${newLink.themeColor === color ? 'border-primary scale-110 shadow-lg' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={newLink.themeColor} 
                    onChange={(e) => setNewLink({...newLink, themeColor: e.target.value})}
                    className="w-10 h-10 rounded-full p-0 border-0 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 font-bold bg-primary text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all">Create Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsManager;