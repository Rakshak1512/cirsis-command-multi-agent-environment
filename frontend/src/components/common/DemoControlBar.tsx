import React from 'react';

// DemoControlBar completely disabled per user requirement:
// "The Admin dashboard should be a real administration interface, NOT a hackathon simulation control panel.
// Remove Demo Controls, Simulation Controls, Scenario Controls, Reset Demo controls from visible Admin UI."
export const DemoControlBar: React.FC<{ currentPath?: string }> = () => {
  return null;
};
