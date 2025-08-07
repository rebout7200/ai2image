import React, { useMemo } from 'react';

interface InfoCardProps {
  icon: string;
  label: string;
  value: string | number;
}

export const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value }) => {
  const renderedValue = useMemo(() => {
    if (!value) return '';
    // Use parseInline to render markdown without creating block-level <p> tags with margins
    if (typeof (window as any).marked?.parseInline === 'function') {
      return (window as any).marked.parseInline(String(value));
    }
    return String(value);
  }, [value]);

  if (!value) return null; // Don't render if there's no value yet

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg flex items-start gap-4 fade-in-card">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-full mt-1">
         <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
        <div
          className="text-base prose prose-card dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderedValue }}
        />
      </div>
    </div>
  );
};