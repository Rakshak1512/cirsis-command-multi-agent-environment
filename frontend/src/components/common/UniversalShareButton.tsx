import React, { useState } from 'react';
import { Share2, ArrowUpRight } from 'lucide-react';
import { Incident } from '../../types';
import { universalShareService } from '../../services/universalShareService';
import { UniversalShareModal } from './UniversalShareModal';

interface UniversalShareButtonProps {
  incident: Incident | null;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const UniversalShareButton: React.FC<UniversalShareButtonProps> = ({
  incident,
  label = 'SHARE',
  className = '',
  size = 'md',
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!incident) return null;

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSharing(true);
    try {
      const res = await universalShareService.shareIncident(incident);
      if (res.fallbackNeeded) {
        setModalOpen(true);
      }
    } catch {
      setModalOpen(true);
    } finally {
      setIsSharing(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[11px] space-x-1',
    md: 'px-3 py-1.5 text-xs space-x-1.5',
    lg: 'px-4 py-2 text-sm space-x-2',
  }[size];

  return (
    <>
      <button
        type="button"
        onClick={handleShareClick}
        disabled={isSharing}
        title="Share incident via native device share or clipboard"
        className={`inline-flex items-center justify-center rounded-xl font-mono font-bold tracking-wider transition-all duration-200
          bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/35 hover:to-blue-600/35
          text-cyan-300 border border-cyan-400/40 hover:border-cyan-300
          shadow-glow hover:shadow-[0_0_20px_rgba(6,182,212,0.45)]
          hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 ${sizeClasses} ${className}`}
      >
        <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>{label}</span>
        <ArrowUpRight className="w-3 h-3 text-cyan-400/80 -ml-0.5" />
      </button>

      {/* Fallback modal shown on desktop without native share or when native share is unavailable */}
      <UniversalShareModal
        incident={incident}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};
