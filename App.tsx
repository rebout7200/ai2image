
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AnalysisData, CombinedData } from './types';
import { AppStatus, initialAnalysisData } from './types';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { generateProfileAnalysisStream } from './services/geminiService';
import { parseStreamingJson } from './utils/jsonParser';
import { generateScript } from './utils/scriptGenerator';
import { parseCsv, transformCsvToCombinedData, CsvRow } from './utils/csvParser';

const App: React.FC = () => {
    const [username, setUsername] = useState('');
    const [status, setStatus] = useState<AppStatus>(AppStatus.Idle);
    const [error, setError] = useState<string | null>(null);
    const [analysisData, setAnalysisData] = useState<AnalysisData>(initialAnalysisData);
    const [rawJsonStream, setRawJsonStream] = useState('');
    const [csvData, setCsvData] = useState<CsvRow[] | null>(null);
    const [usernameForCsv, setUsernameForCsv] = useState('');

    const jsonFileInputRef = useRef<HTMLInputElement>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const matcher = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => document.documentElement.classList.toggle('dark', matcher.matches);
        document.documentElement.classList.toggle('dark', matcher.matches);
        matcher.addEventListener('change', handleChange);
        return () => matcher.removeEventListener('change', handleChange);
    }, []);

    const resetState = useCallback(() => {
        setError(null);
        setStatus(AppStatus.Idle);
        setAnalysisData(initialAnalysisData);
        setRawJsonStream('');
        setUsername('');
        setCsvData(null);
        setUsernameForCsv('');
        if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
        if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }, []);

    const handleGenerateScript = () => {
        if (!process.env.API_KEY) {
            setError("配置错误：API_KEY 未设置。应用程序无法联系 AI 服务。");
            return;
        }
        setError(null);
        
        const { scriptContent, filename } = generateScript();
        const blob = new Blob([scriptContent], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const triggerAIAnalysis = useCallback(async (data: CombinedData, source: 'script' | 'csv' = 'script') => {
        setStatus(AppStatus.Analyzing);
        setAnalysisData(initialAnalysisData);
        setRawJsonStream('');
        setUsername(data.username); // Ensure username is set from the file data

        try {
            const stream = generateProfileAnalysisStream(data.username, data.summaryData, data.actionsData, source);
            let accumulatedJson = '';
            for await (const chunk of stream) {
                accumulatedJson += chunk;
                setRawJsonStream(accumulatedJson);
                const parsedUpdate = parseStreamingJson(accumulatedJson);
                setAnalysisData(prev => ({ ...prev, ...parsedUpdate }));
            }
        } catch (e: any) {
            console.error("AI 分析失败:", e);
            setError(`AI 分析失败: ${e.message}`);
            setStatus(AppStatus.Error);
        } finally {
            setStatus(prev => (prev === AppStatus.Analyzing ? AppStatus.Done : prev));
        }
    }, []);
    
    const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleJsonFileUpload(file);
        }
    };

    const handleJsonFileUpload = (file: File) => {
        setError(null);
        if (!file.name.endsWith('.json')) {
            setError(`文件格式无效。请上传由脚本生成的 JSON 文件。`);
            return;
        }
        if (!file.name.startsWith('analysis_data_')) {
            setError(`文件名格式似乎不正确。请确保上传由官方脚本生成的 'analysis_data_USERNAME.json' 文件。`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const jsonData = JSON.parse(text) as CombinedData;
                
                if (!jsonData.username || !jsonData.summaryData || !jsonData.actionsData) {
                    throw new Error('JSON 文件内容不完整或格式不正确。');
                }
                
                triggerAIAnalysis(jsonData, 'script');

            } catch (err: any) {
                setError(`文件处理失败: ${err.message}`);
                console.error(err);
            }
        };
        reader.onerror = () => {
            setError('读取文件时发生错误。');
        };
        reader.readAsText(file);
    };

    const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleCsvUpload(file);
        }
    };
    
    const handleCsvUpload = (file: File) => {
        setError(null);
        if (!file.name.endsWith('.csv')) {
            setError(`文件格式无效。请上传从论坛下载的 user_archive.csv 文件。`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsedData = parseCsv(text);
                if (parsedData.length === 0) {
                    throw new Error('CSV 文件为空或格式不正确。');
                }
                setCsvData(parsedData);
                setStatus(AppStatus.AwaitingUsername);

            } catch (err: any) {
                setError(`CSV 文件处理失败: ${err.message}`);
                console.error(err);
            }
        };
        reader.onerror = () => {
            setError('读取文件时发生错误。');
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleUsernameSubmitForCsv = (e: React.FormEvent) => {
        e.preventDefault();
        if (!csvData) {
            setError("发生意外错误：CSV 数据丢失。请重新上传文件。");
            setStatus(AppStatus.Error);
            return;
        }
        const submittedUsername = usernameForCsv.trim();
        if (!submittedUsername) return;

        try {
            const combinedData = transformCsvToCombinedData(csvData, submittedUsername);
            triggerAIAnalysis(combinedData, 'csv');
        } catch (err: any) {
            setError(`CSV 数据处理失败: ${err.message}`);
            setStatus(AppStatus.Error);
        } finally {
            setCsvData(null);
            setUsernameForCsv('');
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const handleJsonDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.json')) {
            handleJsonFileUpload(file);
        }
    };
    
    const handleCsvDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.csv')) {
            handleCsvUpload(file);
        }
    };

    const renderUsernamePrompt = () => (
        <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-lg p-8 max-w-lg mx-auto fade-in-card">
            <h2 className="text-2xl font-bold text-center mb-4 text-primary">请输入用户名</h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">请输入与您上传的 CSV 文件关联的 Linux.Do 用户名。</p>
            <form onSubmit={handleUsernameSubmitForCsv}>
                <input
                    type="text"
                    value={usernameForCsv}
                    onChange={(e) => setUsernameForCsv(e.target.value)}
                    placeholder="例如: neo"
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-2 border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    autoFocus
                />
                <div className="flex justify-end gap-4 mt-6">
                     <button type="button" onClick={resetState} className="px-6 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        取消
                    </button>
                    <button type="submit" disabled={!usernameForCsv.trim()} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed flex items-center gap-2">
                        开始分析 <i className="fas fa-arrow-right"></i>
                    </button>
                </div>
            </form>
        </div>
    );

    const renderIdleState = () => (
        <>
            <h2 className="text-lg font-semibold text-center mb-6 text-gray-600 dark:text-gray-400">请选择一种数据提供方式</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Option 1: Script */}
                <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-lg p-6 flex flex-col">
                    <div>
                        <h3 className="text-xl font-bold mb-2 text-primary">方案一：使用脚本抓取 (推荐)</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">脚本将在运行时提示您输入用户名和页面数。只能获取公开数据。</p>
                    </div>

                    <div className="flex-grow flex flex-col space-y-8 mt-6">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">第一步：下载并运行脚本</h4>
                            <button onClick={handleGenerateScript} className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                                <i className="fab fa-node-js mr-2"></i>
                                下载 Node.js 脚本
                            </button>
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                <p className="font-bold mb-1">如何运行:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>确保已安装 <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="underline">Node.js</a>。</li>
                                    <li>将脚本保存到 <strong>新的空文件夹</strong> 中。</li>
                                    <li>在终端进入该文件夹并运行 <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded">npm install puppeteer turndown</code>。</li>
                                    <li>运行脚本: <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded">node get_linuxdo_data.js</code></li>
                                    <li>根据提示输入用户名和页面数。</li>
                                </ol>
                            </div>
                        </div>

                        <div className="flex flex-col flex-grow">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">第二步：上传生成的JSON文件</h4>
                             <div 
                                onDragOver={handleDragOver}
                                onDrop={handleJsonDrop}
                                onClick={() => jsonFileInputRef.current?.click()}
                                className="flex-grow border-2 border-dashed border-border-light dark:border-border-dark rounded-lg p-8 text-center cursor-pointer hover:border-primary dark:hover:border-primary transition-colors flex flex-col justify-center items-center"
                            >
                                <input type="file" ref={jsonFileInputRef} onChange={handleJsonFileChange} accept=".json" className="hidden" />
                                <i className="fas fa-file-upload text-4xl text-gray-400 dark:text-gray-500 mb-4"></i>
                                <p className="text-gray-700 dark:text-gray-300">点击或拖拽 <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded">analysis_data_...json</code> 文件</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Option 2: CSV */}
                <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-lg p-6 flex flex-col">
                    <div>
                        <h3 className="text-xl font-bold mb-2 text-indigo-500">方案二：上传 CSV 文件</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">如果无法运行脚本，可下载论坛的帖子存档进行分析。包括你发布的权限帖。</p>
                    </div>
                    
                    <div className="flex-grow flex flex-col mt-6 space-y-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">上传 <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded text-sm">user_archive.csv</code> 文件</h4>
                        <div 
                            onDragOver={handleDragOver}
                            onDrop={handleCsvDrop}
                            onClick={() => csvFileInputRef.current?.click()}
                            className="flex-grow border-2 border-dashed border-border-light dark:border-border-dark rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors flex flex-col justify-center items-center"
                        >
                            <input type="file" ref={csvFileInputRef} onChange={handleCsvFileChange} accept=".csv" className="hidden" />
                            <i className="fas fa-file-csv text-4xl text-gray-400 dark:text-gray-500 mb-4"></i>
                            <p className="text-gray-700 dark:text-gray-300">点击或拖拽 CSV 文件到此处</p>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg" role="alert">
                    <p className="font-bold">发生错误</p>
                    <p>{error}</p>
                </div>
            )}
        </>
    );
    
    const renderContent = () => {
        switch (status) {
            case AppStatus.Idle:
                return renderIdleState();
            case AppStatus.AwaitingUsername:
                return renderUsernamePrompt();
            case AppStatus.Analyzing:
            case AppStatus.Done:
            case AppStatus.Error:
                 return (
                    <div>
                        <h2 className="text-3xl font-extrabold text-center mb-2">
                           <span className="gradient-text">{username}</span> 的用户画像分析
                        </h2>
                        <AnalysisDashboard 
                            username={username}
                            analysisData={analysisData}
                            isStreaming={status === AppStatus.Analyzing}
                            onReset={resetState}
                        />
                        {error && (
                            <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg" role="alert">
                                <p className="font-bold">发生错误</p>
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };
    
    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <header className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                    <span className="gradient-text">Linux.Do 用户画像分析器</span>
                </h1>
                <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
                    由 Gemini 驱动的 AI 个性洞察工具
                </p>
            </header>
            <main>
                {renderContent()}
            </main>
            <footer className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
                <p>&copy; {new Date().getFullYear()} AI User Analyzer. 本项目仅供技术演示和娱乐，请勿用于非法用途。</p>
            </footer>
        </div>
    );
};

export default App;
