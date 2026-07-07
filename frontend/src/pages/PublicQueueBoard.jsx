import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getOffices } from '../services/offices';
import { getLiveQueue } from '../services/queue';
import { 
  Volume2, VolumeX, Monitor, MapPin, Users, 
  Clock, ArrowRight, ArrowLeft
} from 'lucide-react';

export const PublicQueueBoard = () => {
  const { officeId: routeOfficeId } = useParams();
  
  // States
  const [offices, setOffices] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [board, setBoard] = useState({ now_serving: [], waiting_list: [] });
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Ref to track serving tickets to trigger audio announcements
  const previousServingRef = useRef([]);

  // Fetch offices list
  useEffect(() => {
    getOffices()
      .then((data) => {
        setOffices(data);
        if (routeOfficeId) {
          const matched = data.find((o) => o.id === Number(routeOfficeId));
          if (matched) setSelectedOffice(matched);
        }
      })
      .catch(console.error);
  }, [routeOfficeId]);

  // Load initial board and connect WebSocket
  useEffect(() => {
    if (!selectedOffice) return;

    // 1. Fetch initial board snapshot
    getLiveQueue(selectedOffice.id)
      .then((data) => {
        setBoard(data);
        previousServingRef.current = data.now_serving.map((t) => t.id);
      })
      .catch(console.error);

    // 2. Setup WebSocket connection
    setConnectionStatus('connecting');
    const wsUrl = `ws://localhost:8000/api/v1/queue/ws/${selectedOffice.id}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'queue_update' && payload.data) {
          const newBoard = payload.data;
          
          // Audio announcement check
          if (isAudioEnabled) {
            announceNewTickets(newBoard.now_serving);
          }
          
          setBoard(newBoard);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    ws.onerror = () => {
      setConnectionStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, [selectedOffice, isAudioEnabled]);

  // Text-To-Speech announcement helper
  const announceNewTickets = (currentServing) => {
    currentServing.forEach((ticket) => {
      const isNew = !previousServingRef.current.includes(ticket.id);
      if (isNew && ticket.status === 'called') {
        const phrase = `Ticket number ${ticket.ticket_number.split('').join(' ')}, please proceed to ${ticket.counter_name}`;
        
        // Play simple notification beep using Web Audio API
        playNotificationBeep();
        
        // Speak after a brief delay for natural chime timing
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(phrase);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }, 800);
      }
    });
    
    // Update ref
    previousServingRef.current = currentServing.map((t) => t.id);
  };

  const playNotificationBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      
      // Tone 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.35);

      // Tone 2
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('AudioContext beep failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      {/* Top Banner */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {selectedOffice ? (
            <button
              onClick={() => setSelectedOffice(null)}
              className="p-2 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="Back to Branch Selection"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="px-2.5 py-1 bg-indigo-500 text-white rounded-xl font-bold text-sm">QF</div>
          )}
          <div>
            <h1 className="font-extrabold text-white tracking-tight leading-none text-base">QFlow Lobby Board</h1>
            {selectedOffice && (
              <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                <MapPin size={12} className="text-indigo-400" />
                {selectedOffice.name}
              </p>
            )}
          </div>
        </div>

        {selectedOffice && (
          <div className="flex items-center gap-3">
            {/* Connection Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-850">
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
              }`}></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {connectionStatus}
              </span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setIsAudioEnabled(!isAudioEnabled);
                if (!isAudioEnabled) playNotificationBeep();
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isAudioEnabled 
                  ? 'bg-emerald-650/15 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-900 border border-slate-850 text-slate-400'
              }`}
            >
              {isAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              Voice Alerts: {isAudioEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </header>

      {/* BRANCH SELECTOR PANEL */}
      {!selectedOffice ? (
        <main className="flex-1 flex items-center justify-center p-6 bg-radial from-slate-900 via-slate-950 to-black relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-lg w-full z-10 space-y-6 text-center">
            <div className="inline-flex p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl mb-2">
              <Monitor size={36} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Select Lobby Board</h2>
            <p className="text-slate-450 text-sm max-w-sm mx-auto">Choose a branch location to open the live public queue display board.</p>

            <div className="grid gap-3 max-w-md mx-auto pt-2">
              {offices.map((office) => (
                <div
                  key={office.id}
                  onClick={() => setSelectedOffice(office)}
                  className="p-4 bg-slate-900/60 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer text-left flex justify-between items-center group transition-all"
                >
                  <div>
                    <h3 className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">{office.name}</h3>
                    <p className="text-slate-500 text-xs mt-1">{office.address}, {office.city}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </div>
        </main>
      ) : (
        /* LOBBY SCREEN SPLIT VIEW */
        <main className="flex-1 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-900 bg-slate-950">
          
          {/* NOW SERVING PANEL (Lobby Left) */}
          <div className="p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-widest">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                Now Serving
              </div>
              
              {board.now_serving.length === 0 ? (
                <div className="py-24 text-center text-slate-600 font-medium">
                  <p className="text-lg">No active tickets called</p>
                  <p className="text-xs text-slate-500 mt-1">Lobby is currently clear.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {board.now_serving.map((ticket, index) => (
                    <div 
                      key={ticket.id} 
                      className={`p-6 bg-slate-900 border rounded-3xl flex items-center justify-between gap-6 transition-all ${
                        index === 0 
                          ? 'border-indigo-500 shadow-2xl shadow-indigo-500/5 bg-indigo-500/[0.02]' 
                          : 'border-slate-850'
                      }`}
                    >
                      <div>
                        <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Ticket</div>
                        <h2 className={`font-black tracking-tight mt-1 ${
                          index === 0 ? 'text-5xl sm:text-6xl text-white' : 'text-3xl text-slate-300'
                        }`}>
                          {ticket.ticket_number}
                        </h2>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Proceed To</div>
                        <div className={`font-black mt-1 ${
                          index === 0 ? 'text-2xl sm:text-3xl text-indigo-400' : 'text-lg text-slate-400'
                        }`}>
                          {ticket.counter_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Public footer marquee */}
            <div className="bg-slate-900/40 p-4 border border-slate-900 rounded-2xl text-xs text-slate-500 flex gap-2.5 items-center">
              <Users size={16} className="text-indigo-400 shrink-0" />
              <p>Attention Citizens: Please listen for audio calls. Keep your booking details ready for the desk officer.</p>
            </div>
          </div>

          {/* UPCOMING WAITLIST PANEL (Lobby Right) */}
          <div className="p-8 space-y-6 bg-slate-950/60 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-indigo-400 font-extrabold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={14} />
                Upcoming Queue
              </div>
              
              <span className="text-xs text-slate-500 font-medium">Wait times are estimations</span>
            </div>

            {board.waiting_list.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                <Users size={40} className="text-slate-800 mb-2" />
                <p className="text-sm font-semibold">Lobby queue is empty</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {board.waiting_list.map((ticket) => (
                  <div key={ticket.id} className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-white text-base">{ticket.ticket_number}</h4>
                      <p className="text-slate-500 text-xs mt-0.5">{ticket.service_name}</p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Est. Wait</div>
                      <div className="text-xs font-bold text-indigo-400 mt-0.5">{ticket.estimated_wait_minutes} min</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
};

export default PublicQueueBoard;
