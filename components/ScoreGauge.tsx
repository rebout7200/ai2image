import React from 'react';

interface ScoreGaugeProps {
  score: number;
  label: string;
  description: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, label, description }) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 45; // 45 is the radius
  const offset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-lg p-6 flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle className="gauge-bg" cx="50" cy="50" r="45" strokeWidth="10"></circle>
          <circle
            className="gauge-fg"
            cx="50"
            cy="50"
            r="45"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          ></circle>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-primary">
          {Math.round(normalizedScore)}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{label}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
};