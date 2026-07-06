import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAppointments, createAppointment, cancelAppointment, checkInAppointment } from '../services/appointments';
import { getOffices } from '../services/offices';
import { getServices } from '../services/services';
import type { Appointment } from '../types/appointment';
import type { Office } from '../types/office';
import type { Service } from '../types/service';
import { 
  LogOut, User as UserIcon, Calendar, Clock, MapPin, 
  Plus, X, Check, AlertCircle, QrCode
} from 'lucide-react';

export const CitizenDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  
  // States
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Booking Wizard States
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  
  // QR Code / Check-in Modal States
  const [activeQrAppt, setActiveQrAppt] = useState<Appointment | null>(null);
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Fetch Citizen appointments
  const fetchAppointments = async () => {
    try {
      const data = await getAppointments();
      // Only keep non-completed / non-cancelled active or pending ones on top
      setAppointments(data);
    } catch (err: any) {
      setError(err?.detail || 'Failed to fetch appointments');
    }
  };

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        await fetchAppointments();
        const officesData = await getOffices();
        setOffices(officesData);
      } catch (err: any) {
        setError(err?.detail || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch services when office is selected
  useEffect(() => {
    if (selectedOffice) {
      getServices(selectedOffice.id)
        .then(setServices)
        .catch(() => setError('Failed to load services for this office'));
    } else {
      setServices([]);
    }
  }, [selectedOffice]);

  // Cancel Appointment handler
  const handleCancel = async (apptId: number) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await cancelAppointment(apptId);
      await fetchAppointments();
    } catch (err: any) {
      alert(err?.detail || 'Cancellation failed');
    }
  };

  // self check-in handler
  const handleSelfCheckIn = async (appt: Appointment) => {
    setIsCheckingIn(true);
    setCheckInResult(null);
    try {
      // Calls check-in using the qr_code_token
      const queueEntry = await checkInAppointment(appt.id, appt.qr_code_token);
      setCheckInResult({
        success: true,
        message: `Checked in successfully! You are at position ${queueEntry.position}. Estimated wait: ${queueEntry.estimated_wait_minutes} minutes.`
      });
      await fetchAppointments();
    } catch (err: any) {
      setCheckInResult({
        success: false,
        message: err?.detail || 'Check-in failed. Ensure you are at the office during the check-in window.'
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Submit Booking handler
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffice || !selectedService || !bookingDate || !bookingTime) return;
    
    setIsSubmittingBooking(true);
    setError(null);
    try {
      // Combine date and time
      const scheduledTime = new Date(`${bookingDate}T${bookingTime}`).toISOString();
      await createAppointment({
        office_id: selectedOffice.id,
        service_id: selectedService.id,
        scheduled_time: scheduledTime,
      });
      
      // Reset wizard
      setIsBookingOpen(false);
      setBookingStep(1);
      setSelectedOffice(null);
      setSelectedService(null);
      setBookingDate('');
      setBookingTime('');
      
      await fetchAppointments();
    } catch (err: any) {
      setError(err?.detail || 'Booking failed. Make sure the date is not a holiday.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-black text-sm tracking-wide">
              QF
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">QFlow</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:inline">Welcome, <strong className="text-white">{user?.full_name}</strong></span>
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

      {/* Main Panel */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 grid lg:grid-cols-3 gap-8">
        
        {/* Left Columns - Appointments List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Your Appointments</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">Book slots, check-in, and view your tickets.</p>
            </div>
            
            <button
              onClick={() => setIsBookingOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-755 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/10 active:scale-95 cursor-pointer transition-all"
            >
              <Plus size={16} />
              Book Appointment
            </button>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-2xl flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-3xl p-16 text-center text-slate-500">
              <Calendar className="mx-auto mb-4 text-slate-650" size={48} />
              <h3 className="text-lg font-bold text-slate-400">No appointments scheduled</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Book your first appointment to avoid long queues.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                const apptDate = new Date(appt.scheduled_time);
                const isCheckinable = appt.status === 'confirmed';
                
                return (
                  <div key={appt.id} className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-slate-700/50 transition-colors">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
                          #{appt.id}
                        </span>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          appt.status === 'confirmed' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' :
                          appt.status === 'checked_in' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                          appt.status === 'in_progress' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                          appt.status === 'completed' ? 'bg-slate-500/15 text-slate-400 border border-slate-800' :
                          'bg-rose-500/15 text-rose-450 border border-rose-500/20'
                        }`}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white">
                        {offices.find(o => o.id === appt.office_id)?.name || 'Office Branch'}
                      </h3>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 gap-x-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={15} />
                          {apptDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={15} />
                          {apptDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCheckinable && (
                        <button
                          onClick={() => {
                            setActiveQrAppt(appt);
                            setCheckInResult(null);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all cursor-pointer shadow-lg shadow-emerald-600/10"
                        >
                          <QrCode size={16} />
                          Self Check-In
                        </button>
                      )}
                      
                      {['confirmed', 'pending'].includes(appt.status) && (
                        <button
                          onClick={() => handleCancel(appt.id)}
                          className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-rose-400 hover:text-rose-300 text-sm font-semibold rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Columns - Profile & Info */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Your Profile</h2>
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 flex items-center justify-center">
                <UserIcon size={22} />
              </div>
              <div>
                <div className="font-bold text-white leading-tight">{user?.full_name}</div>
                <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mt-0.5">{user?.role_name}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-400 border-t border-slate-800/60 pt-4">
              <div><strong>Email:</strong> {user?.email}</div>
              <div><strong>Phone:</strong> {user?.phone || 'Not provided'}</div>
              <div><strong>Language:</strong> {user?.language_pref.toUpperCase()}</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-white">How Check-In works:</h3>
            <ul className="space-y-3 text-sm text-slate-400 list-disc list-inside">
              <li>Check-in opens <strong className="text-slate-200">15 minutes before</strong> your appointment slot.</li>
              <li>You can check in up to <strong className="text-slate-200">30 minutes after</strong> your slot.</li>
              <li>Self check-in uses your location/QR code. If check-in fails, staff can manually check you in at the desk.</li>
            </ul>
          </div>
        </div>
      </main>

      {/* --- BOOKING WIZARD MODAL --- */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            <button
              onClick={() => {
                setIsBookingOpen(false);
                setBookingStep(1);
                setSelectedOffice(null);
                setSelectedService(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Modal Title */}
            <div className="px-6 py-5 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Book Appointment</h2>
              <div className="flex gap-1.5 mt-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${
                      s <= bookingStep ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleBookAppointment}>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5">
                {/* STEP 1: SELECT OFFICE */}
                {bookingStep === 1 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Select Office Branch</h3>
                    <div className="space-y-2">
                      {offices.map((office) => (
                        <div
                          key={office.id}
                          onClick={() => setSelectedOffice(office)}
                          className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-start gap-3 ${
                            selectedOffice?.id === office.id
                              ? 'border-indigo-500 bg-indigo-500/5'
                              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                          }`}
                        >
                          <div className="mt-0.5 text-indigo-400">
                            <MapPin size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm">{office.name}</h4>
                            <p className="text-slate-400 text-xs mt-0.5">{office.address}, {office.city}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 2: SELECT SERVICE */}
                {bookingStep === 2 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Select Service</h3>
                    {services.length === 0 ? (
                      <div className="text-center text-slate-500 text-sm py-4">No active services offered at this branch.</div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {services.map((service) => (
                          <div
                            key={service.id}
                            onClick={() => setSelectedService(service)}
                            className={`p-4 border rounded-2xl cursor-pointer transition-all ${
                              selectedService?.id === service.id
                                ? 'border-indigo-500 bg-indigo-500/5'
                                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                            }`}
                          >
                            <h4 className="font-bold text-white text-sm">{service.name}</h4>
                            <p className="text-slate-400 text-xs mt-1">Est. Duration: {service.avg_duration_minutes}m</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: SCHEDULE TIME */}
                {bookingStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Select Date & Time</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Date</label>
                        <input
                          type="date"
                          value={bookingDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:border-indigo-500 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Time Slot</label>
                        <input
                          type="time"
                          value={bookingTime}
                          onChange={(e) => setBookingTime(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:border-indigo-500 text-sm"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Buttons */}
              <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800/80 flex justify-between gap-3">
                {bookingStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setBookingStep(prev => prev - 1)}
                    className="px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                ) : (
                  <div></div>
                )}

                {bookingStep < 3 ? (
                  <button
                    type="button"
                    disabled={
                      (bookingStep === 1 && !selectedOffice) ||
                      (bookingStep === 2 && !selectedService)
                    }
                    onClick={() => setBookingStep(prev => prev + 1)}
                    className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-650 disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmittingBooking || !bookingDate || !bookingTime}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-755 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-500/10"
                  >
                    {isSubmittingBooking ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={16} />
                        Confirm Booking
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- QR CODE & SELF CHECK-IN MODAL --- */}
      {activeQrAppt && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            <button
              onClick={() => {
                setActiveQrAppt(null);
                setCheckInResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">QR Code & Check-In</h3>
            <p className="text-slate-400 text-xs mb-6">Present this QR code to the scanner, or click self check-in.</p>

            {/* Dynamic Real QR Code rendering via open api */}
            <div className="bg-white p-4 inline-block rounded-2xl mb-6 shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${activeQrAppt.id}:${activeQrAppt.qr_code_token}`}
                alt="QR Code"
                className="w-40 h-40"
              />
            </div>

            {checkInResult ? (
              <div className={`p-4 border rounded-2xl text-sm font-medium mb-2 ${
                checkInResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}>
                {checkInResult.message}
              </div>
            ) : (
              <button
                onClick={() => handleSelfCheckIn(activeQrAppt)}
                disabled={isCheckingIn}
                className="w-full py-3 px-4 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-2xl active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isCheckingIn ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Check size={18} />
                    Check In Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenDashboard;
