
import React from 'react';
import { Screen } from '../types';

interface HeaderProps {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
}

const NavItem: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`font-orbitron uppercase text-sm px-4 py-2 rounded-md transition-all duration-300 relative ${
      isActive
        ? 'text-cyan-300 bg-cyan-900/30'
        : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50'
    }`}
  >
    {label}
    {isActive && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 cyan-glow"></div>
    )}
  </button>
);

const Header: React.FC<HeaderProps> = ({ activeScreen, setActiveScreen }) => {
  return (
    <header className="flex justify-between items-center p-4 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 border-2 border-cyan-400 rounded-full flex items-center justify-center cyan-glow">
          <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></div>
        </div>
        <h1 className="font-orbitron text-xl text-white">AETHERIUM</h1>
      </div>
      <nav className="flex space-x-2 p-1 bg-slate-800/50 rounded-lg">
        <NavItem
          label="Cognitive Dashboard"
          isActive={activeScreen === Screen.COGNITIVE_DASHBOARD}
          onClick={() => setActiveScreen(Screen.COGNITIVE_DASHBOARD)}
        />
        <NavItem
          label="Command Console"
          isActive={activeScreen === Screen.COMMAND_CONSOLE}
          onClick={() => setActiveScreen(Screen.COMMAND_CONSOLE)}
        />
        <NavItem
          label="Tools & Senses"
          isActive={activeScreen === Screen.TOOLS_PANEL}
          onClick={() => setActiveScreen(Screen.TOOLS_PANEL)}
        />
      </nav>
      <div className="text-right">
        <p className="text-xs text-slate-400">System Status</p>
        <p className="text-sm text-green-400 font-medium">All Systems Nominal</p>
      </div>
    </header>
  );
};

export default Header;
