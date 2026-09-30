import React from 'react';
import { useLocationStore } from '../../store/useLocationStore';
import { Activity, RotateCw, Copy, Check, ShieldCheck, ShieldAlert, Eye } from 'lucide-react';

export const LocationDebugPanel: React.FC = () => {
  const isDebugEnv = import.meta.env.DEV || import.meta.env.VITE_LOCATION_DEBUG === 'true';

  if (!isDebugEnv) {
    return null;
  }

  const {
    latitude,
    longitude,
    accuracy,
    bestAccuracy,
    timestamp,
    address,
    qualityState,
    permission,
    source,
    errorMessage,
    isWatching,
    refreshLocation,
  } = useLocationStore();

  const [copied, setCopied] = React.useState(false);

  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
  const protocol = typeof window !== 'undefined' ? window.location.protocol.replace(':', '') : 'http';

  const debugText = `LOCATION DIAGNOSTICS
-------------------------
Permission: ${permission}
Source: ${source}
Latitude: ${latitude !== null ? latitude : 'null'}
Longitude: ${longitude !== null ? longitude : 'null'}
Accuracy: ${accuracy !== null ? `${accuracy} meters` : 'null'}
Timestamp: ${timestamp ? new Date(timestamp).toISOString() : 'null'}
Secure Context: ${isSecure}
Watching: ${isWatching}
Best Accuracy: ${bestAccuracy !== null ? `${bestAccuracy} meters` : 'null'}
Quality State: ${qualityState}
Address: ${address || 'null'}
Error: ${errorMessage || 'none'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <div className="w-full my-3 p-4 rounded-2xl bg-black/85 border border-emerald-500/40 text-emerald-400 font-mono text-[11px] shadow-[0_0_30px_rgba(16,185,129,0.15)] backdrop-blur-xl">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/30">
        <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-emerald-300">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>LOCATION DEBUG (SECTION 13 DIAGNOSTICS)</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/60 text-emerald-300 flex items-center space-x-1 transition-all"
            title="Copy GPS telemetry to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-emerald-400" />}
            <span>{copied ? 'COPIED' : 'COPY GPS'}</span>
          </button>
          <button
            type="button"
            onClick={() => refreshLocation()}
            className="px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/40 hover:bg-cyan-900/60 text-cyan-300 flex items-center space-x-1 transition-all"
            title="Force refresh device position"
          >
            <RotateCw className="w-3 h-3 text-cyan-400" />
            <span>TRIGGER GPS</span>
          </button>
        </div>
      </div>

      {/* Secure Context Warning */}
      {!isSecure && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 flex items-center space-x-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Secure HTTPS connection required for accurate location access on mobile devices.</span>
        </div>
      )}

      {/* Diagnostics Grid Matching Section 13 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 py-1">
        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">PERMISSION</div>
          <div className={`font-bold text-xs mt-0.5 ${
            permission === 'granted' ? 'text-emerald-400' : permission === 'denied' ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {permission}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">SOURCE</div>
          <div className="font-bold text-xs mt-0.5 text-white">{source}</div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">LATITUDE</div>
          <div className="font-bold text-xs mt-0.5 text-cyan-200">
            {latitude !== null ? latitude.toFixed(6) : 'Awaiting fix...'}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">LONGITUDE</div>
          <div className="font-bold text-xs mt-0.5 text-cyan-200">
            {longitude !== null ? longitude.toFixed(6) : 'Awaiting fix...'}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">ACCURACY</div>
          <div className={`font-bold text-xs mt-0.5 ${
            accuracy !== null && accuracy <= 50 ? 'text-emerald-400' :
            accuracy !== null && accuracy <= 150 ? 'text-cyan-300' : 'text-amber-400'
          }`}>
            {accuracy !== null ? `${accuracy} meters` : 'Pending'}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">WATCHING</div>
          <div className={`font-bold text-xs mt-0.5 flex items-center space-x-1 ${
            isWatching ? 'text-emerald-400' : 'text-slate-400'
          }`}>
            <Eye className="w-3 h-3" />
            <span>{isWatching ? 'true (active)' : 'false'}</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">SECURE CONTEXT</div>
          <div className={`font-bold text-xs mt-0.5 flex items-center space-x-1 ${
            isSecure ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            <span>{isSecure ? 'true' : 'false'}</span>
            {isSecure ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">BEST ACCURACY</div>
          <div className="font-bold text-xs mt-0.5 text-emerald-300">
            {bestAccuracy !== null ? `${bestAccuracy}m` : 'null'}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-slate-500 uppercase mr-1">TIMESTAMP:</span>
          <span className="text-slate-300">{timestamp ? `${timestamp} (${new Date(timestamp).toLocaleTimeString()})` : 'null'}</span>
        </div>
        <div>
          <span className="text-slate-500 uppercase mr-1">QUALITY STATE:</span>
          <span className="text-cyan-300 font-bold">{qualityState}</span>
        </div>
        <div className="md:col-span-2">
          <span className="text-slate-500 uppercase mr-1">REVERSE GEOCODED STREET:</span>
          <span className="text-cyan-200 font-bold">{address || 'Awaiting coordinates...'}</span>
        </div>
        {errorMessage && (
          <div className="md:col-span-2 text-rose-400">
            <span className="uppercase font-bold mr-1">ERROR:</span>
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
