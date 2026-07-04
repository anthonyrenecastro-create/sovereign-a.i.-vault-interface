
import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', icon }) => {
  return (
    <div className={`bg-slate-900/40 backdrop-blur-md border border-cyan-400/20 rounded-lg p-4 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(0,199,255,0.2)] ${className}`}>
      <div className="flex items-center justify-between mb-3 text-cyan-300">
        <h3 className="font-orbitron text-sm uppercase tracking-wider">{title}</h3>
        {icon}
      </div>
      <div>{children}</div>
    </div>
  );
};

export default Card;
