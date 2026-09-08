import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileVideo, RefreshCw, ShieldAlert, Film, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTelemetryForVideo, type VideoTelemetryPayload } from '../types/telemetry';

export interface VideoIngestionSectionProps {
  onVideoSelect?: (video: VideoTelemetryPayload) => void;
  className?: string;
}

export const VideoIngestionSection: React.FC<VideoIngestionSectionProps> = ({ onVideoSelect, className }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [customFile, setCustomFile] = useState<{ name: string; size: string } | null>(null);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previousObjectUrlRef.current && previousObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousObjectUrlRef.current);
      }
    };
  }, []);

  const safeRevokePreviousObjectUrl = () => {
    if (previousObjectUrlRef.current && previousObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previousObjectUrlRef.current);
      previousObjectUrlRef.current = null;
    }
  };

  const processVideoPayload = (payload: VideoTelemetryPayload) => {
    setIsProcessing(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);

          if (payload.riskLevel === 'High' || payload.riskLevel === 'Critical') {
            setActiveAlert(`Critical Handling Risk Detected: ${payload.behaviors.join(', ')} in ${payload.title}`);
          } else {
            setActiveAlert(null);
          }

          if (onVideoSelect) {
            onVideoSelect(payload);
          }
          return 100;
        }
        return prev + 25;
      });
    }, 180);
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;

    const validExtensions = ['.mp4', '.avi', '.mov'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      alert('Invalid file format. Please upload .mp4, .avi, or .mov video files.');
      return;
    }

    const maxSizeBytes = 200 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert('File exceeds maximum size limit of 200MB.');
      return;
    }

    safeRevokePreviousObjectUrl();

    const blobUrl = URL.createObjectURL(file);
    previousObjectUrlRef.current = blobUrl;

    const formattedSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const telemetryPayload = generateTelemetryForVideo(file.name, file.size, 'Custom Optical Stream', blobUrl);
    telemetryPayload.isCustomUpload = true;

    setCustomFile({
      name: file.name,
      size: formattedSize
    });

    processVideoPayload(telemetryPayload);
  };

  const handleSampleVideoSelect = (filename: string, bay: string) => {
    safeRevokePreviousObjectUrl();
    setCustomFile({
      name: filename,
      size: '18.4 MB'
    });

    const videoUrl = `/videos/${encodeURIComponent(filename)}`;
    const telemetryPayload = generateTelemetryForVideo(filename, undefined, bay, videoUrl);
    processVideoPayload(telemetryPayload);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Alert Banner */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              <span className="font-semibold">{activeAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveAlert(null)}
              className="bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded hover:bg-amber-400 text-xs transition-colors"
            >
              Acknowledge
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stream Upload Zone (Unified Dark Mode bg-slate-900) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Optical Video Stream Ingestion
              </h3>
              <p className="text-[11px] text-slate-400">
                Upload CCTV or warehouse surveillance video footage to evaluate frame-by-frame YOLO11 detection and temporal risk metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-slate-950 text-slate-400 px-2.5 py-1 rounded-md border border-slate-800">
              Max 200MB (.mp4, .avi, .mov)
            </span>
            <button
              type="button"
              onClick={() => handleSampleVideoSelect('Rolling and dropping carton.mp4', 'Loading Bay 1')}
              className="text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-700 transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Load Sample Video
            </button>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? 'border-primary bg-primary/10 shadow-inner scale-[1.005]'
              : 'border-slate-800 bg-slate-950 hover:border-slate-600 hover:bg-slate-850'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.avi,.mov"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />

          <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-md">
            <FileVideo className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-200">
              Drag & Drop Video File or <span className="text-primary underline">Browse File</span>
            </p>
            <p className="text-xs text-slate-400">
              Supports <span className="font-mono text-slate-300">.MP4, .AVI, .MOV</span> formats up to 200MB
            </p>
          </div>
        </div>

        {/* Metadata & Stream Status Bar */}
        {customFile && (
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Film className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-200">{customFile.name}</p>
                <p className="text-[10px] text-slate-400">{customFile.size} • Active Browser Memory Stream</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                STREAM LOADED
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-slate-400 hover:text-white underline px-1"
              >
                Change File
              </button>
            </div>
          </div>
        )}

        {/* Processing Progress Indicator */}
        {isProcessing && (
          <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-primary/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-primary flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Running YOLO11 Detection & Tracking Pipeline...
              </span>
              <span className="font-mono font-bold text-slate-200">{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary via-blue-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoIngestionSection;
