"use client";

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ScanPage = () => {
  const [isScanning, setIsScanning] = useState(true);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isScanning) {
      startCamera();
    }
    
    // Cleanup function to stop camera when component unmounts or page changes
    return () => {
      stopCamera();
    };
  }, [isScanning]);

  // Additional cleanup on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      }
    };

    const handleBeforeUnload = () => {
      stopCamera();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError('');
      
      // Stop existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Unable to access camera. Please upload an image instead.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const processQRCode = (qrCodeData: string) => {
    try {
      // Stop camera before navigation
      stopCamera();
      
      // Extract the verification path from the QR code URL
      const url = new URL(qrCodeData);
      const pathname = url.pathname;
      
      // Check if it's a verify URL
      if (pathname.startsWith('/verify/')) {
        router.push(pathname);
      } else {
        setError('Invalid QR code. Please scan a valid product verification code.');
      }
    } catch {
      setError('Invalid QR code format.');
    }
  };

  const scanQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setScanning(true);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      try {
        // Import QR code scanner dynamically
        const QrScanner = (await import('qr-scanner')).default;
        const result = await QrScanner.scanImage(canvas);
        processQRCode(result);
      } catch {
        setError('No QR code found. Please try again.');
      }
    }
    setScanning(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setScanning(true);
      setError('');
      
      // Import QR code scanner dynamically
      const QrScanner = (await import('qr-scanner')).default;
      const result = await QrScanner.scanImage(file);
      processQRCode(result);
    } catch {
      setError('No QR code found in the image.');
    }
    setScanning(false);
  };

  const handleBack = () => {
    stopCamera();
    router.push('/');
  };

  const handleClose = () => {
    stopCamera();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={handleBack} className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors">
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <h1 className="text-lg font-semibold gradient-text">Scan QR Code</h1>
            <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6">
        {isScanning ? (
          <div className="space-y-6">
            {/* Camera View */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-80 object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-white/80 rounded-2xl shadow-lg">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg"></div>
                </div>
              </div>
            </div>

            {/* Scan Button */}
            <button
              onClick={scanQRCode}
              disabled={scanning}
              className="w-full gradient-purple-blue text-white py-4 rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              {scanning ? 'Scanning...' : 'Scan QR Code'}
            </button>

            {/* Upload Option */}
            <div className="text-center">
              <p className="text-white/70 text-sm mb-3">Or upload an image</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 w-full border-2 border-dashed border-white/20 hover:border-white/40 py-4 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                <Upload size={20} />
                <span className="font-medium">Upload Image</span>
              </button>
            </div>
          </div>
        ) : (
          // Upload Only Interface
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <Camera size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Camera Not Available</h2>
              <p className="text-white/70">Upload an image of the QR code instead</p>
            </div>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full gradient-purple-blue text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              Upload Image
            </button>
            
            <button
              onClick={() => setIsScanning(true)}
              className="w-full border-2 border-white/20 hover:border-white/40 text-white/70 hover:text-white py-4 rounded-xl font-medium hover:bg-white/5 transition-all duration-300"
            >
              Try Camera Again
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-6 glass-card border border-red-500/20 rounded-2xl p-4">
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Hidden Elements */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default ScanPage;