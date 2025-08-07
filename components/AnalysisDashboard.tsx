import React, { useMemo, useRef } from 'react';
import type { AnalysisData } from '../types';
import { ScoreGauge } from './ScoreGauge';
import { InfoCard } from './InfoCard';
import { toPng } from 'html-to-image';


interface AnalysisDashboardProps {
  username: string;
  analysisData: AnalysisData;
  isStreaming: boolean;
  onReset: () => void;
}

const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; hasData: boolean }> = ({ title, icon, children, hasData }) => {
  if (!hasData) return null;
  return (
    <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4 gradient-text">
        <i className={`fas ${icon} mr-3`}></i>{title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
};


export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ username, analysisData, isStreaming, onReset }) => {
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleSaveScreenshot = () => {
    if (!dashboardRef.current) return;
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#111827' : '#F9FAFB';

    toPng(dashboardRef.current, {
        pixelRatio: 2, // Increase resolution for better quality
        backgroundColor: backgroundColor,
    }).then(dataUrl => {
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.download = `linuxdo-analysis-${username}-${date}.png`;
        link.href = dataUrl;
        link.click();
    }).catch(err => {
        console.error("Failed to save screenshot:", err);
        alert("抱歉，截图失败。请检查控制台获取更多信息。");
    });
  };

  const renderedSummary = useMemo(() => {
    if (!analysisData.summary) return '';
    if (typeof (window as any).marked?.parse === 'function') {
      return (window as any).marked.parse(analysisData.summary);
    }
    return analysisData.summary.replace(/\n/g, '<br/>'); // Fallback
  }, [analysisData.summary]);
  
  const hasData = (obj: any) => Object.values(obj).some(v => v !== '' && v !== 0 && v !== null);

  return (
    <div className="mt-8">
      {/* Header Bar with Reset and Save */}
      <div className="h-10 flex justify-end items-center mb-8">
         {!isStreaming && (
            <div className="flex items-center gap-4">
               <button
                  onClick={handleSaveScreenshot}
                  className="px-4 py-2 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 rounded-lg hover:bg-green-500/20 dark:hover:bg-green-500/30 transition-colors flex items-center gap-2"
                  title="保存为图片"
                >
                  <i className="fas fa-camera"></i>
                  <span>保存截图</span>
                </button>
                <button
                  onClick={onReset}
                  className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
                  title="重新分析"
                >
                  <i className="fas fa-sync-alt"></i>
                  <span>重新分析</span>
                </button>
            </div>
        )}
      </div>

      {/* Capture Target */}
      <div ref={dashboardRef} className="space-y-8">
        {/* Scores */}
        {(analysisData.confidenceScore > 0 || analysisData.dataCompletenessScore > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 fade-in-card">
              <ScoreGauge score={analysisData.confidenceScore} label="AI 可信度" description="AI 对其分析结果的自信程度" />
              <ScoreGauge score={analysisData.dataCompletenessScore} label="数据完整度" description="用于分析的数据是否充足" />
          </div>
        )}

        <Section title="基本信息推测" icon="fa-clipboard-user" hasData={hasData(analysisData.basicInfo)}>
          <InfoCard icon="fa-venus-mars" label="性别推测" value={analysisData.basicInfo.gender} />
          <InfoCard icon="fa-cake-candles" label="年龄推测" value={analysisData.basicInfo.age} />
          <InfoCard icon="fa-calendar-day" label="生日/星座" value={analysisData.basicInfo.birthday} />
        </Section>

        <Section title="职业背景分析" icon="fa-briefcase" hasData={hasData(analysisData.professionalProfile)}>
          <InfoCard icon="fa-user-tie" label="可能职业" value={analysisData.professionalProfile.occupation} />
          <InfoCard icon="fa-code" label="技术水平" value={analysisData.professionalProfile.technicalLevel} />
          <InfoCard icon="fa-building" label="工作经验" value={analysisData.professionalProfile.experience} />
          <InfoCard icon="fa-industry" label="行业背景" value={analysisData.professionalProfile.industry} />
        </Section>
        
        <Section title="经济状况推测" icon="fa-sack-dollar" hasData={hasData(analysisData.economicStatus)}>
          <InfoCard icon="fa-money-bill-wave" label="收入水平" value={analysisData.economicStatus.incomeLevel} />
          <InfoCard icon="fa-shopping-cart" label="消费观念" value={analysisData.economicStatus.spendingHabits} />
        </Section>
        
        <Section title="个性特征分析" icon="fa-brain" hasData={hasData(analysisData.personality)}>
          <InfoCard icon="fa-puzzle-piece" label="性格类型 (MBTI)" value={analysisData.personality.mbti} />
          <InfoCard icon="fa-users" label="社交风格" value={analysisData.personality.socialStyle} />
          <InfoCard icon="fa-heart" label="兴趣爱好" value={analysisData.personality.hobbies} />
          <InfoCard icon="fa-scale-balanced" label="价值观念" value={analysisData.personality.values} />
        </Section>

        <Section title="生活状况推测" icon="fa-house-user" hasData={hasData(analysisData.lifestyle)}>
          <InfoCard icon="fa-map-marker-alt" label="居住地推测" value={analysisData.lifestyle.location} />
          <InfoCard icon="fa-running" label="生活节奏" value={analysisData.lifestyle.lifePace} />
          <InfoCard icon="fa-bed" label="生活状态" value={analysisData.lifestyle.lifeState} />
        </Section>

        {/* Summary Section */}
        {analysisData.summary && (
          <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-lg p-6 fade-in-card">
              <h2 className="text-xl font-bold mb-4 gradient-text">
                  <i className="fas fa-file-invoice mr-3"></i>综合个人简介
              </h2>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: renderedSummary }}></div>
               {isStreaming && <span className="blinking-cursor ml-1"></span>}
          </div>
        )}
        
        {isStreaming && !analysisData.summary && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="loading-spinner mx-auto mb-4"></div>
              <p>AI 正在实时生成分析报告，请稍候...</p>
          </div>
        )}

        {!isStreaming && analysisData.summary && (
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-r-lg fade-in-card">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <i className="fas fa-info-circle mr-2"></i>
                  <strong>免责声明：</strong>本分析基于公开数据和AI推理，仅供娱乐参考，不代表用户真实情况。请理性看待分析结果。
              </p>
          </div>
        )}
      </div>
    </div>
  );
};