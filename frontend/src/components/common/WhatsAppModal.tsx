import React from 'react';
import { UniversalShareModal } from './UniversalShareModal';
import { Incident } from '../../types';

interface WhatsAppModalProps {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Universal Native Device Sharing Modal
 * Replaced external WhatsApp API modal with OS/browser native sharing and clipboard fallback.
 */
export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ incident, isOpen, onClose }) => {
  return <UniversalShareModal incident={incident} isOpen={isOpen} onClose={onClose} />;
};
