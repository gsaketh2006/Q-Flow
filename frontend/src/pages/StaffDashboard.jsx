import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getOffices, getCounters } from '../services/offices';
import { getActiveQueue, callNextTicket, startService, completeService, skipService } from '../services/queue';
import { getAppointments, checkInAppointment } from '../services/appointments';
import { 
  LogOut, Layers, Power, RefreshCw, CheckCircle, 
  User, Search, AlertCircle, Play, Check, X, Timer, Camera
} from 'lucide-react';
import CameraScanner from '../components/CameraScanner';

export const StaffDashboard = () => {
  const { logout } = useAuth();

  // Settings / Setup States
  const [offices, setOffices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [selectedCounter, setSelectedCounter] = useState(null);
  const [isCounterSetup, setIsCounterSetup] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Live Queue & Serving States
  const [queue, setQueue] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState(null);

  // Timer States
  const [serviceSeconds, setServiceSeconds] = useState(0);
  const timerRef = useRef(null);

  // Manual Check-In States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAppointments, setSearchAppointments] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Load setup data
  useEffect(() => {
    async function loadSetup() {
      try {
        const officesData = await getOffices();
        setOffices(officesData);
        
        // Restore from localStorage if any
        const savedOfficeId = localStorage.getItem('staff_office_id');
        const savedCounterId = localStorage.getItem('staff_counter_id');
        if (savedOfficeId) {
          const officeObj = officesData.find(o => o.id === Number(savedOfficeId));
          if (officeObj) {
            setSelectedOffice(officeObj);
            const countersData = await getCounters(officeObj.id);
            setCounters(countersData);
            if (savedCounterId) {
              const counterObj = countersData.find(c => c.id === Number(savedCounterId));
              if (counterObj) {
                setSelectedCounter(counterObj);
                setIsCounterSetup(true);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load setups:', err);
      }
    }
    loadSetup();
  }, []);

  // Fetch counters when office changes
  const handleOfficeChange = async (office) => {
    setSelectedOffice(office);
    setSelectedCounter(null);
    try {
      const countersData = await getCounters(office.id);
      setCounters(countersData);
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm Setup
  const handleSaveSetup = () => {
    if (selectedOffice && selectedCounter) {
      localStorage.setItem('staff_office_id', String(selectedOffice.id));
      localStorage.setItem('staff_counter_id', String(selectedCounter.id));
      setIsCounterSetup(true);
    }
  };

  // Fetch waiting list
  const fetchQueueList = async () => {
    if (!selectedOffice) return;
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const entries = await getActiveQueue(selectedOffice.id);
      
      const servingOnMyCounter = entries.find(
        (e) => e.counter_id === selectedCounter?.id && ['called', 'processing'].includes(e.status)
      );
      if (servingOnMyCounter) {
        setActiveTicket(servingOnMyCounter);
      } else {
        setActiveTicket(null);
      }

      setQueue(entries.filter((e) => e.status === 'waiting'));
    } catch (err) {
      setQueueError(err?.detail || 'Failed to fetch queue list');
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Poll for queue changes when online
  useEffect(() => {
    let interval;
    if (isCounterSetup && selectedOffice) {
      fetchQueueList();
      interval = window.setInterval(() => {
        fetchQueueList();
      }, 8000);
    }
    return () => clearInterval(interval);
  }, [isCounterSetup, selectedOffice, selectedCounter]);

  // Serve Timer control
  useEffect(() => {
    if (activeTicket?.status === 'processing') {
      setServiceSeconds(0);
      timerRef.current = window.setInterval(() => {
        setServiceSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTicket?.status]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- QUEUE ACTIONS ---
  const handleCallNext = async () => {
    if (!selectedCounter) return;
    setQueueError(null);
    try {
      const entry = await callNextTicket(selectedCounter.id);
      setActiveTicket(entry);
      await fetchQueueList();
    } catch (err) {
      alert(err?.detail || 'No citizens waiting in line.');
    }
  };

  const handleStartService = async () => {
    if (!activeTicket) return;
    try {
      await startService(activeTicket.id);
      await fetchQueueList();
    } catch (err) {
      alert(err?.detail || 'Failed to start service.');
    }
  };

  const handleCompleteService = async () => {
    if (!activeTicket) return;
    try {
      await completeService(activeTicket.id);
      setActiveTicket(null);
      await fetchQueueList();
    } catch (err) {
      alert(err?.detail || 'Failed to complete service.');
    }
  };

  const handleSkipService = async () => {
    if (!activeTicket) return;
    if (!window.confirm('Mark this citizen as a no-show and skip?')) return;
    try {
      await skipService(activeTicket.id);
      setActiveTicket(null);
      await fetchQueueList();
    } catch (err) {
      alert(err?.detail || 'Failed to skip ticket.');
    }
  };

  // --- MANUAL SEARCH & CHECK-IN ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const appts = await getAppointments({
        office_id: selectedOffice?.id,
        status_filter: 'confirmed',
      });
      const query = searchQuery.toLowerCase();
      const filtered = appts.filter(
        (a) =>
          a.id.toString() === query ||
          a.citizen_name?.toLowerCase().includes(query)
      );
      setSearchAppointments(filtered);
      if (filtered.length === 0) {
        setSearchError('No matching active bookings found.');
      }
    } catch (err) {
      setSearchError('Search request failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualCheckIn = async (apptId) => {
    try {
      await checkInAppointment(apptId);
      alert('Citizen checked in successfully!');
      setSearchAppointments([]);
      setSearchQuery('');
      await fetchQueueList();
    } catch (err) {
      alert(err?.detail || 'Manual check-in failed.');
    }
  };

  const handleScanSuccess = async (decodedText) => {
    setIsScannerOpen(false);
    try {
      const parts = decodedText.split(':');
      if (parts.length !== 2) {
        alert('Invalid QR Code format.');
        return;
      }
      const apptId = Number(parts[0]);
      const token = parts[1];
      await checkInAppointment(apptId, token);
      alert('Citizen checked in successfully!');
      await fetchQueueList();
    } catch (err) {
      alert(err?.detail || 'Scan check-in failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-violet-600 text-white rounded-xl font-bold text-sm">QF</div>
            <span className="font-extrabold text-white text-lg tracking-tight">QFlow</span>
            {isCounterSetup && (
              <span className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/25 text-violet-300 rounded-lg text-xs font-semibold">
                {selectedOffice?.name} — {selectedCounter?.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {isCounterSetup && (
              <button
                onClick={() => {
                  localStorage.removeItem('staff_counter_id');
                  setIsCounterSetup(false);
                  setIsOnline(false);
                  setActiveTicket(null);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Change Counter
              </button>
            )}
            
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 text-slate-350 hover:text-white rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* SETUP CARD */}
      {!isCounterSetup ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <Layers size={36} className="text-violet-400 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Counter Setup</h2>
              <p className="text-slate-450 text-xs mt-1">Assign yourself to an office and serving window.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Office Branch</label>
                <select
                  value={selectedOffice?.id || ''}
                  onChange={(e) => {
                    const obj = offices.find(o => o.id === Number(e.target.value));
                    if (obj) handleOfficeChange(obj);
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:border-violet-500 text-sm cursor-pointer"
                >
                  <option value="" disabled>Select Branch</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Counter window</label>
                <select
                  value={selectedCounter?.id || ''}
                  onChange={(e) => {
                    const obj = counters.find(c => c.id === Number(e.target.value));
                    if (obj) setSelectedCounter(obj);
                  }}
                  disabled={!selectedOffice}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 disabled:opacity-40 rounded-2xl text-white outline-none focus:border-violet-500 text-sm cursor-pointer"
                >
                  <option value="" disabled>Select Counter</option>
                  {counters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSaveSetup}
                disabled={!selectedOffice || !selectedCounter}
                className="w-full py-3.5 bg-gradient-to-r from-violet-550 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white font-bold rounded-2xl disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-violet-500/10 mt-2"
              >
                Launch Console
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* CONSOLE CONTAINER */
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 grid md:grid-cols-3 gap-8">
          {/* Left Column (2/3) - Ticket Management */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Status Control Panel */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                <div>
                  <h3 className="font-bold text-white">Console Status</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{isOnline ? 'Online — Ready to call citizens' : 'On Break / Offline'}</p>
                </div>
              </div>
              
              <button
                onClick={() => setIsOnline(!isOnline)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all cursor-pointer ${
                  isOnline 
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 hover:bg-emerald-500/20'
                }`}
              >
                <Power size={16} />
                {isOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>

            {/* Serving Ticket Card */}
            {isOnline ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none"></div>
                
                {activeTicket ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 bg-violet-500/10 border border-violet-500/25 text-violet-300 rounded-full text-xs font-semibold uppercase tracking-wider">
                          Currently Serving
                        </span>
                        <h2 className="text-4xl font-extrabold text-white mt-3 tracking-tight">
                          {activeTicket.ticket_number}
                        </h2>
                      </div>
                      
                      {activeTicket.status === 'processing' && (
                        <div className="flex items-center gap-2 text-violet-300 font-mono text-xl font-bold bg-slate-950 px-4 py-2 rounded-2xl border border-slate-850">
                          <Timer size={20} className="animate-spin" style={{ animationDuration: '3s' }} />
                          {formatTimer(serviceSeconds)}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-800/80 pt-6 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Citizen</div>
                        <div className="text-base font-bold text-white mt-0.5 flex items-center gap-1.5">
                          <User size={16} className="text-slate-400" />
                          {activeTicket.citizen_name}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Service</div>
                        <div className="text-base font-bold text-white mt-0.5">
                          {activeTicket.service_name}
                        </div>
                      </div>
                    </div>

                    {/* Action controls */}
                    <div className="flex flex-wrap gap-3 border-t border-slate-800/80 pt-6">
                      {activeTicket.status === 'called' && (
                        <button
                          onClick={handleStartService}
                          className="flex items-center gap-1.5 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-2xl active:scale-95 transition-all cursor-pointer"
                        >
                          <Play size={16} />
                          Start Service
                        </button>
                      )}
                      {activeTicket.status === 'processing' && (
                        <button
                          onClick={handleCompleteService}
                          className="flex items-center gap-1.5 px-5 py-3 bg-emerald-650 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl active:scale-95 transition-all cursor-pointer"
                        >
                          <Check size={16} />
                          Complete
                        </button>
                      )}
                      
                      <button
                        onClick={handleSkipService}
                        className="flex items-center gap-1.5 px-4 py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-rose-450 text-sm font-semibold rounded-2xl active:scale-95 transition-all cursor-pointer"
                      >
                        <X size={16} />
                        No Show / Skip
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <CheckCircle className="mx-auto text-slate-700" size={48} />
                    <h3 className="text-lg font-bold text-slate-400">Ready for next citizen</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto mb-2">Click Call Next to fetch the next ticket from the queue.</p>
                    <button
                      onClick={handleCallNext}
                      className="px-6 py-3 bg-gradient-to-r from-violet-550 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-violet-550/15 active:scale-95 transition-all cursor-pointer"
                    >
                      Call Next Ticket
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 border-dashed rounded-3xl p-12 text-center text-slate-500">
                <Power className="mx-auto mb-3 text-slate-750" size={40} />
                <h3 className="text-base font-bold text-slate-400">Offline</h3>
                <p className="text-xs text-slate-500 mt-1">Switch status to Online to call and serve citizens.</p>
              </div>
            )}

            {/* Manual Check-in desk */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">Citizen Check-in Desk</h3>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  <Camera size={14} />
                  Scan QR Code
                </button>
              </div>
              
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Booking ID or Citizen Name..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-2xl outline-none text-sm text-white transition-all placeholder-slate-650"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-850 hover:border-slate-800 text-slate-200 text-sm font-semibold rounded-2xl transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>

              {searchError && <div className="text-xs text-rose-450">{searchError}</div>}

              {searchAppointments.length > 0 && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-850">
                  {searchAppointments.map((appt) => (
                    <div key={appt.id} className="p-3.5 bg-slate-950/40 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-white">{appt.citizen_name || 'Citizen'}</div>
                        <div className="text-xs text-slate-450 mt-0.5">Booking #{appt.id} • Scheduled: {new Date(appt.scheduled_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <button
                        onClick={() => handleManualCheckIn(appt.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Check In
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (1/3) - Live Waitlist Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  Waiting list
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-350 rounded-full text-[10px] font-bold">
                    {queue.length}
                  </span>
                </h3>
                <button
                  onClick={fetchQueueList}
                  className="p-1.5 hover:bg-slate-855 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {queueError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-350 text-xs rounded-xl flex items-center gap-1.5 mb-4">
                  <AlertCircle size={14} />
                  {queueError}
                </div>
              )}

              {isLoadingQueue && queue.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-slate-800 border-t-violet-500 rounded-full animate-spin"></div>
                </div>
              ) : queue.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-4">
                  <CheckCircle size={32} className="text-slate-700 mb-2" />
                  <div className="text-xs font-bold text-slate-450">Queue is empty</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">No checked-in citizens are waiting.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {queue.map((entry) => (
                    <div key={entry.id} className="p-3 bg-slate-950/50 border border-slate-850 hover:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-violet-300">{entry.ticket_number}</div>
                        <div className="text-xs text-white font-semibold mt-0.5">{entry.citizen_name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{entry.service_name}</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-slate-400">Position</div>
                        <div className="text-xs font-bold text-white">{entry.position}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {isScannerOpen && (
        <CameraScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};

export default StaffDashboard;
