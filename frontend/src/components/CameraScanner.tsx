import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Failed to stop QR scanner:', err);
      }
    }
  };

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode('qr-reader');
    scannerRef.current = html5Qrcode;

    const startScanner = async () => {
      try {
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          (decodedText) => {
            stopScanner().then(() => {
              onScanSuccess(decodedText);
            });
          },
          () => {
            // Ignore frame scan failures (silent lookup)
          }
        );
      } catch (err) {
        console.error('Failed to start QR scanner:', err);
      }
    };

    // Delay start slightly to allow the div container to fully mount in DOM
    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [onScanSuccess]);

  const handleClose = () => {
    stopScanner().then(onClose);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-bold text-white mb-2">Scan Appointment QR</h3>
        <p className="text-slate-400 text-xs mb-6 font-medium">Position the QR code inside the camera window below.</p>

        {/* Video feed container */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black aspect-square relative mb-4">
          <div id="qr-reader" className="w-full h-full"></div>
          {/* Glowing scan target line */}
          <div className="absolute inset-x-8 top-1/2 h-0.5 bg-indigo-500 animate-pulse shadow-md shadow-indigo-500/50 pointer-events-none"></div>
        </div>
        
        <p className="text-slate-500 text-[10px]">Using system media web-camera</p>
      </div>
    </div>
  );
};

export default CameraScanner;
