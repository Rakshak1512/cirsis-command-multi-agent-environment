import React, { useState } from 'react';
import { Share2, Copy, Check, MapPin, ExternalLink, Download, FileText, X, AlertCircle } from 'lucide-react';
import { Incident } from '../../types';
import { universalShareService, IncidentSharePayload } from '../../services/universalShareService';

interface UniversalShareModalProps {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  customPayload?: IncidentSharePayload;
}

export const UniversalShareModal: React.FC<UniversalShareModalProps> = ({ incident, isOpen, onClose, customPayload }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen || !incident) return null;

  const payload = customPayload || universalShareService.formatIncidentShare(incident);

  const handleCopyLink = async () => {
    const ok = await universalShareService.copyUrl(payload.url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyDetails = async () => {
    const ok = await universalShareService.copyText(payload.text);
    if (ok) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleDownloadReport = () => {
    const element = document.createElement('a');
    const file = new Blob([payload.text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `CrisisCommand-Report-${incident.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0b1329] border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-glow">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-white">SHARE INCIDENT</h3>
            <p className="text-xs text-slate-400 font-mono">Emergency Alert #{incident.id}</p>
          </div>
        </div>

        {/* Formatted Alert Box */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 space-y-1 mb-5 max-h-52 overflow-y-auto whitespace-pre-line leading-relaxed">
          {payload.text}
        </div>

        {/* Graceful Fallback Options */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 font-semibold text-xs transition-all shadow-glow"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'COPY LINK'}</span>
            </button>

            <button
              onClick={handleCopyDetails}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <FileText className="w-4 h-4" />}
              <span>{copiedText ? 'Details Copied!' : 'COPY DETAILS'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={payload.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-medium text-xs border border-cyan-500/30 transition-all"
            >
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>OPEN MAP</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            </a>

            <button
              onClick={handleDownloadReport}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-xs border border-slate-700 transition-all"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>DOWNLOAD REPORT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
