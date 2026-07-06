import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  getOffices, createOffice, updateOffice, deleteOffice,
  getCounters, createCounter, deleteCounter,
  getHolidays, createHoliday, deleteHoliday 
} from '../services/offices';
import { getServices, createService, updateService, deleteService } from '../services/services';
import { getSummaryReport, getOfficeReport, getStaffReport } from '../services/reports';
import type { Office, Counter, Holiday } from '../types/office';
import type { Service } from '../types/service';
import type { SummaryReport, OfficeReport } from '../types/report';
import { 
  LogOut, Plus, Trash2, Edit2, X, Calendar, BarChart2, 
  Briefcase, MapPin, Clock, Activity, Users, Hourglass, CheckCircle
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'offices' | 'services' | 'holidays' | 'reports'>('offices');
  
  // Data States
  const [offices, setOffices] = useState<Office[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | null>(null);
  
  // Analytics State
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [officeReport, setOfficeReport] = useState<OfficeReport | null>(null);
  const [selectedReportOfficeId, setSelectedReportOfficeId] = useState<number | null>(null);
  const [staffReportId, setStaffReportId] = useState<string>('');
  const [staffReportResult, setStaffReportResult] = useState<any | null>(null);

  // Modal / Form States
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [officeName, setOfficeName] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officeCity, setOfficeCity] = useState('');

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(15);

  const [counterName, setCounterName] = useState('');
  const [counterStaffId, setCounterStaffId] = useState<string>('');

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');

  // Initial Data Load
  const fetchAllOffices = async () => {
    try {
      const data = await getOffices();
      setOffices(data);
      if (data.length > 0 && !selectedOfficeId) {
        setSelectedOfficeId(data[0].id);
        setSelectedReportOfficeId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAllOffices();
  }, []);

  // Fetch Tab Specific Data
  useEffect(() => {
    if (activeTab === 'services' && selectedOfficeId) {
      getServices(selectedOfficeId).then(setServices).catch(console.error);
      getCounters(selectedOfficeId).then(setCounters).catch(console.error);
    } else if (activeTab === 'holidays' && selectedOfficeId) {
      getHolidays(selectedOfficeId).then(setHolidays).catch(console.error);
    } else if (activeTab === 'reports') {
      getSummaryReport().then(setSummaryReport).catch(console.error);
      if (selectedReportOfficeId) {
        getOfficeReport(selectedReportOfficeId).then(setOfficeReport).catch(console.error);
      }
    }
  }, [activeTab, selectedOfficeId, selectedReportOfficeId]);

  // --- OFFICES CRUD ---
  const handleOfficeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOffice) {
        await updateOffice(editingOffice.id, {
          name: officeName,
          address: officeAddress,
          city: officeCity,
        });
      } else {
        await createOffice({
          name: officeName,
          address: officeAddress,
          city: officeCity,
        });
      }
      setIsOfficeModalOpen(false);
      setEditingOffice(null);
      setOfficeName('');
      setOfficeAddress('');
      setOfficeCity('');
      fetchAllOffices();
    } catch (err) {
      alert('Failed to save office.');
    }
  };

  const handleEditOffice = (office: Office) => {
    setEditingOffice(office);
    setOfficeName(office.name);
    setOfficeAddress(office.address);
    setOfficeCity(office.city);
    setIsOfficeModalOpen(true);
  };

  const handleDeleteOffice = async (id: number) => {
    if (!window.confirm('Deactivate this office branch?')) return;
    try {
      await deleteOffice(id);
      fetchAllOffices();
    } catch (err) {
      alert('Delete failed.');
    }
  };

  // --- SERVICES CRUD ---
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeId) return;
    try {
      if (editingService) {
        await updateService(editingService.id, {
          name: serviceName,
          avg_duration_minutes: serviceDuration,
        });
      } else {
        await createService({
          name: serviceName,
          office_id: selectedOfficeId,
          avg_duration_minutes: serviceDuration,
        });
      }
      setIsServiceModalOpen(false);
      setEditingService(null);
      setServiceName('');
      setServiceDuration(15);
      // Reload
      getServices(selectedOfficeId).then(setServices);
    } catch (err) {
      alert('Failed to save service.');
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceName(service.name);
    setServiceDuration(service.avg_duration_minutes);
    setIsServiceModalOpen(true);
  };

  const handleDeleteService = async (id: number) => {
    if (!window.confirm('Deactivate this service?')) return;
    try {
      await deleteService(id);
      if (selectedOfficeId) getServices(selectedOfficeId).then(setServices);
    } catch (err) {
      alert('Delete failed.');
    }
  };

  // --- COUNTERS CRUD ---
  const handleAddCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeId || !counterName) return;
    try {
      const staffId = counterStaffId ? Number(counterStaffId) : null;
      await createCounter(selectedOfficeId, counterName, staffId);
      setCounterName('');
      setCounterStaffId('');
      getCounters(selectedOfficeId).then(setCounters);
    } catch (err) {
      alert('Failed to create counter.');
    }
  };

  const handleDeleteCounter = async (counterId: number) => {
    if (!selectedOfficeId || !window.confirm('Delete this counter?')) return;
    try {
      await deleteCounter(selectedOfficeId, counterId);
      getCounters(selectedOfficeId).then(setCounters);
    } catch (err) {
      alert('Delete failed.');
    }
  };

  // --- HOLIDAYS CRUD ---
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeId || !holidayDate || !holidayDesc) return;
    try {
      await createHoliday(selectedOfficeId, { date: holidayDate, description: holidayDesc });
      setHolidayDate('');
      setHolidayDesc('');
      getHolidays(selectedOfficeId).then(setHolidays);
    } catch (err) {
      alert('Failed to create holiday.');
    }
  };

  const handleDeleteHoliday = async (holidayId: number) => {
    if (!selectedOfficeId || !window.confirm('Delete this holiday?')) return;
    try {
      await deleteHoliday(selectedOfficeId, holidayId);
      getHolidays(selectedOfficeId).then(setHolidays);
    } catch (err) {
      alert('Delete failed.');
    }
  };

  // --- REPORT QUERY ---
  const handleStaffReportQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffReportId) return;
    try {
      const res = await getStaffReport(Number(staffReportId));
      setStaffReportResult(res);
    } catch (err) {
      alert('Report failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-amber-500 text-black rounded-xl font-bold text-sm">QF</div>
            <span className="font-extrabold text-white text-lg tracking-tight">QFlow</span>
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-lg text-xs font-semibold">
              Admin Portal
            </span>
          </div>
          
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 text-slate-350 hover:text-white rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col md:flex-row gap-8">
        
        {/* Left Tab Navigation */}
        <aside className="md:w-60 shrink-0 space-y-1.5">
          <button
            onClick={() => setActiveTab('offices')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
              activeTab === 'offices' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MapPin size={18} />
            Office Branches
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
              activeTab === 'services' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Briefcase size={18} />
            Services & Counters
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
              activeTab === 'holidays' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calendar size={18} />
            Holidays / Closures
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
              activeTab === 'reports' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart2 size={18} />
            Analytics & Reports
          </button>

          {/* Office selector dropdown for Services/Holidays tab */}
          {['services', 'holidays'].includes(activeTab) && (
            <div className="pt-6 border-t border-slate-900 mt-4 space-y-2">
              <label className="block text-[10px] font-semibold text-slate-450 uppercase tracking-wider">Viewing Office Branch</label>
              <select
                value={selectedOfficeId || ''}
                onChange={(e) => setSelectedOfficeId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
              >
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </aside>

        {/* Right Dashboard Body */}
        <section className="flex-1 bg-slate-900/40 border border-slate-850 p-8 rounded-3xl min-h-[500px]">
          
          {/* TAB 1: OFFICES LIST */}
          {activeTab === 'offices' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Office Branches</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Add, edit, or de-activate regional branches.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingOffice(null);
                    setOfficeName('');
                    setOfficeAddress('');
                    setOfficeCity('');
                    setIsOfficeModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  Add Office
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {offices.map((office) => (
                  <div key={office.id} className="p-5 bg-slate-900 border border-slate-850 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-white text-base">{office.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          office.is_active ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-450 border border-rose-500/25'
                        }`}>
                          {office.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-2 flex items-start gap-1.5">
                        <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
                        {office.address}, {office.city}
                      </p>
                    </div>

                    <div className="flex gap-2 border-t border-slate-850/60 pt-4 mt-5 justify-end">
                      <button
                        onClick={() => handleEditOffice(office)}
                        className="p-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteOffice(office.id)}
                        className="p-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-rose-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: SERVICES & COUNTERS */}
          {activeTab === 'services' && (
            <div className="space-y-8">
              
              {/* SERVICES SECTION */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-white">Services Offered</h3>
                    <p className="text-slate-400 text-xs">Configure service types and average processing times.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingService(null);
                      setServiceName('');
                      setServiceDuration(15);
                      setIsServiceModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-lg active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Service
                  </button>
                </div>

                <div className="border border-slate-850 rounded-2xl overflow-hidden divide-y divide-slate-855">
                  {services.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">No active services registered.</div>
                  ) : (
                    services.map((svc) => (
                      <div key={svc.id} className="p-4 bg-slate-900/60 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-bold text-white">{svc.name}</div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <Clock size={13} />
                            Avg duration: {svc.avg_duration_minutes} minutes
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditService(svc)}
                            className="p-1.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteService(svc.id)}
                            className="p-1.5 bg-slate-950 border border-slate-800 text-rose-400 hover:text-rose-350 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COUNTERS SECTION */}
              <div className="space-y-4 border-t border-slate-900 pt-8">
                <div>
                  <h3 className="text-base font-bold text-white">Serving Counters / Windows</h3>
                  <p className="text-slate-400 text-xs">Assign counters and associate staff credentials.</p>
                </div>

                {/* Add Counter inline form */}
                <form onSubmit={handleAddCounter} className="flex flex-wrap gap-2.5 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
                  <input
                    type="text"
                    value={counterName}
                    onChange={(e) => setCounterName(e.target.value)}
                    placeholder="Counter Name (e.g. Counter 4)"
                    className="flex-1 min-w-[150px] px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none"
                    required
                  />
                  <input
                    type="number"
                    value={counterStaffId}
                    onChange={(e) => setCounterStaffId(e.target.value)}
                    placeholder="Staff User ID (Optional)"
                    className="w-40 px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    Add Counter
                  </button>
                </form>

                <div className="border border-slate-850 rounded-2xl overflow-hidden divide-y divide-slate-855">
                  {counters.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">No serving counters registered.</div>
                  ) : (
                    counters.map((cnt) => (
                      <div key={cnt.id} className="p-4 bg-slate-900/60 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-bold text-white">{cnt.name}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Staff Assignment: {cnt.assigned_staff_id ? `User ID #${cnt.assigned_staff_id}` : 'Unassigned'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCounter(cnt.id)}
                          className="p-1.5 bg-slate-950 border border-slate-800 text-rose-450 hover:text-rose-350 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HOLIDAYS / CLOSURES */}
          {activeTab === 'holidays' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Holidays & Office Closures</h2>
                <p className="text-slate-400 text-xs mt-0.5">Schedule closures. Booking wizard automatically blocks appointment slots on holidays.</p>
              </div>

              {/* Add Holiday Form */}
              <form onSubmit={handleAddHoliday} className="grid sm:grid-cols-3 gap-3 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none"
                  required
                />
                <input
                  type="text"
                  value={holidayDesc}
                  onChange={(e) => setHolidayDesc(e.target.value)}
                  placeholder="Closure description (e.g. Labor Day)"
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  Schedule Closure
                </button>
              </form>

              <div className="border border-slate-850 rounded-2xl overflow-hidden divide-y divide-slate-855">
                {holidays.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">No holidays scheduled for this branch.</div>
                ) : (
                  holidays.map((h) => (
                    <div key={h.id} className="p-4 bg-slate-900/60 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-white">{h.description}</div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Calendar size={13} />
                          Date: {new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="p-1.5 bg-slate-950 border border-slate-800 text-rose-450 hover:text-rose-350 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS & REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-white">System Analytics</h2>
                <p className="text-slate-400 text-xs mt-0.5">Real-time performance indexes and average durations.</p>
              </div>

              {/* KPI Grid */}
              {summaryReport && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl">
                    <div className="text-slate-450 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={14} className="text-indigo-400" />
                      Total Bookings
                    </div>
                    <div className="text-3xl font-extrabold text-white mt-2">{summaryReport.total_appointments}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl">
                    <div className="text-slate-450 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-450" />
                      Completed
                    </div>
                    <div className="text-3xl font-extrabold text-white mt-2">{summaryReport.completed_appointments}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl">
                    <div className="text-slate-450 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-rose-400" />
                      No Show Rate
                    </div>
                    <div className="text-3xl font-extrabold text-white mt-2">{summaryReport.no_show_rate_percent}%</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl">
                    <div className="text-slate-450 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Hourglass size={14} className="text-amber-400" />
                      Avg Wait Time
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{summaryReport.average_wait_time_minutes}m</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl">
                    <div className="text-slate-450 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={14} className="text-violet-400" />
                      Avg Service Time
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{summaryReport.average_service_time_minutes}m</div>
                  </div>
                </div>
              )}

              {/* Office specific statistics */}
              <div className="border-t border-slate-900 pt-8 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <h3 className="font-bold text-white text-sm">Office Branch Performance</h3>
                  <select
                    value={selectedReportOfficeId || ''}
                    onChange={(e) => setSelectedReportOfficeId(Number(e.target.value))}
                    className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none"
                  >
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                {officeReport && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/30 p-4 border border-slate-850 rounded-2xl">
                    <div>
                      <div className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Total Booked</div>
                      <div className="text-lg font-bold text-white mt-1">{officeReport.total_appointments}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Completed</div>
                      <div className="text-lg font-bold text-white mt-1">{officeReport.completed_appointments}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Avg Wait Time</div>
                      <div className="text-lg font-bold text-white mt-1">{officeReport.average_wait_time_minutes}m</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Avg Service</div>
                      <div className="text-lg font-bold text-white mt-1">{officeReport.average_service_time_minutes}m</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Staff performance query */}
              <div className="border-t border-slate-900 pt-8 space-y-4">
                <h3 className="font-bold text-white text-sm">Staff Performance Tracker</h3>
                <form onSubmit={handleStaffReportQuery} className="flex gap-2">
                  <input
                    type="number"
                    value={staffReportId}
                    onChange={(e) => setStaffReportId(e.target.value)}
                    placeholder="Enter Staff User ID (e.g. 2)..."
                    className="w-56 px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl active:scale-95 cursor-pointer"
                  >
                    Query Staff
                  </button>
                </form>

                {staffReportResult && (
                  <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-2xl max-w-sm space-y-2 text-xs text-slate-400">
                    <div><strong>Staff User ID:</strong> #{staffReportResult.staff_user_id}</div>
                    <div><strong>Completed Tickets Served:</strong> {staffReportResult.tickets_completed}</div>
                    <div><strong>Average Service Duration:</strong> {staffReportResult.average_service_time_minutes} minutes</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* --- ADD/EDIT OFFICE MODAL --- */}
      {isOfficeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsOfficeModalOpen(false);
                setEditingOffice(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-white mb-4">
              {editingOffice ? 'Edit Office Branch' : 'Add Office Branch'}
            </h3>

            <form onSubmit={handleOfficeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Office Name</label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="Office Name"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Address</label>
                <input
                  type="text"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="Address"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">City</label>
                <input
                  type="text"
                  value={officeCity}
                  onChange={(e) => setOfficeCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer mt-2"
              >
                Save Branch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT SERVICE MODAL --- */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsServiceModalOpen(false);
                setEditingService(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-white mb-4">
              {editingService ? 'Edit Service' : 'Add Service'}
            </h3>

            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Service Name</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Service Name"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Avg Duration (minutes)</label>
                <input
                  type="number"
                  value={serviceDuration}
                  min={1}
                  onChange={(e) => setServiceDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs outline-none text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer mt-2"
              >
                Save Service
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
