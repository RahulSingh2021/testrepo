'use client';

import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  HelpCircle, 
  Type, 
  CheckSquare, 
  CircleDot, 
  Image as ImageIcon, 
  Video, 
  Save, 
  X, 
  ChevronDown, 
  PlusCircle,
  FileText,
  AlertCircle,
  Eye,
  Settings2,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  /* Added missing icon imports */
  Upload,
  Activity,
  Info,
  Play
} from 'lucide-react';

type QuestionType = 'radio' | 'checkbox' | 'objective' | 'image' | 'video';

interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string | string[];
  mediaUrl?: string;
  points: number;
}

const QuizCreator: React.FC = () => {
  const [quizTitle, setQuizTitle] = useState("");
  const [quizInstructions, setQuizInstructions] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  const addQuestion = (type: QuestionType) => {
    const newQ: QuizQuestion = {
      id: `q-${Date.now()}`,
      type,
      text: "",
      options: type === 'radio' || type === 'checkbox' || type === 'image' || type === 'video' ? ["", ""] : [],
      correctAnswer: type === 'checkbox' ? [] : "",
      points: 1,
    };
    setQuestions([...questions, newQ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, options: [...q.options, ""] } : q));
  };

  const removeOption = (qId: string, optIdx: number) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, options: q.options.filter((_, i) => i !== optIdx) } : q));
  };

  const handleSaveQuiz = () => {
    if (!quizTitle) {
      alert("Please provide a Quiz Title.");
      return;
    }
    if (questions.length === 0) {
      alert("Please add at least one question.");
      return;
    }
    alert("Quiz synchronization initiated. Record finalized in Learning Vault.");
  };

  const QuestionIcon = ({ type }: { type: QuestionType }) => {
    switch (type) {
      case 'radio': return <CircleDot size={18} className="text-blue-500" />;
      case 'checkbox': return <CheckSquare size={18} className="text-emerald-500" />;
      case 'objective': return <Type size={18} className="text-purple-500" />;
      case 'image': return <ImageIcon size={18} className="text-orange-500" />;
      case 'video': return <Video size={18} className="text-rose-500" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Command Terminal */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[2rem] shadow-inner border border-indigo-100 ring-4 ring-white">
            <BookOpen size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">Quiz Authoring Hub</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500" /> Competency Assessment Protocol
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-[1.5rem] border border-slate-200">
           <button 
             onClick={() => setActiveTab('editor')}
             className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'editor' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Builder
           </button>
           <button 
             onClick={() => setActiveTab('preview')}
             className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Preview
           </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSaveQuiz}
            className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-3"
          >
            <Save size={18} /> Finalize Quiz
          </button>
        </div>
      </div>

      {activeTab === 'editor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Workspace (Questions) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 space-y-8">
               <div className="space-y-6 border-b border-slate-100 pb-8">
                  <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Curriculum / Quiz Title</label>
                      <input 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-xl font-black focus:border-indigo-500 focus:bg-white transition-all shadow-inner outline-none uppercase placeholder:text-slate-300"
                        placeholder="ENTER ASSESSMENT TITLE..."
                        value={quizTitle}
                        onChange={e => setQuizTitle(e.target.value)}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Guidelines & Instructions</label>
                      <textarea 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:bg-white transition-all shadow-inner outline-none resize-none h-24 placeholder:text-slate-300"
                        placeholder="Detail passing scores, time limits, or specific domain focus..."
                        value={quizInstructions}
                        onChange={e => setQuizInstructions(e.target.value)}
                      />
                  </div>
               </div>

               <div className="space-y-8">
                  {questions.length > 0 ? questions.map((q, qIdx) => (
                    <div key={q.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 relative group hover:border-indigo-200 transition-all shadow-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 rounded-l-[2.5rem]" />
                        <div className="flex justify-between items-start mb-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                                 {(qIdx + 1).toString().padStart(2, '0')}
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                                 <QuestionIcon type={q.type} />
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{q.type} Type</span>
                              </div>
                           </div>
                           <button 
                             onClick={() => removeQuestion(q.id)}
                             className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                           >
                             <Trash2 size={20} />
                           </button>
                        </div>

                        <div className="space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Question Content</label>
                              <input 
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-base font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                placeholder="State the question..."
                                value={q.text}
                                onChange={e => updateQuestion(q.id, { text: e.target.value })}
                              />
                           </div>

                           {/* Media Handling (Image/Video) */}
                           {(q.type === 'image' || q.type === 'video') && (
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset URL / Reference</label>
                                 <div className="flex gap-2">
                                    <input 
                                      className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                      placeholder={`Enter ${q.type} source URL...`}
                                      value={q.mediaUrl || ''}
                                      onChange={e => updateQuestion(q.id, { mediaUrl: e.target.value })}
                                    />
                                    <button className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all">
                                       {/* Added missing Upload icon import */}
                                       <Upload size={20} />
                                    </button>
                                 </div>
                              </div>
                           )}

                           {/* Options Handling */}
                           {q.type !== 'objective' && (
                             <div className="space-y-4">
                               <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Options</label>
                                  <button 
                                    onClick={() => addOption(q.id)}
                                    className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                                  >
                                    + Add Option
                                  </button>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${q.type === 'checkbox' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                          {String.fromCharCode(65 + oIdx)}
                                       </div>
                                       <input 
                                         className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700"
                                         placeholder={`Option ${oIdx + 1}...`}
                                         value={opt}
                                         onChange={e => {
                                           const next = [...q.options];
                                           next[oIdx] = e.target.value;
                                           updateQuestion(q.id, { options: next });
                                         }}
                                       />
                                       <button 
                                         onClick={() => removeOption(q.id, oIdx)}
                                         className="p-1.5 text-slate-300 hover:text-rose-500"
                                       >
                                         <X size={14} />
                                       </button>
                                    </div>
                                  ))}
                               </div>
                             </div>
                           )}

                           <div className="pt-6 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                              <div className="flex items-center gap-4 w-full md:w-auto">
                                 <div className="flex flex-col">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Point Node</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                      {[1, 2, 5].map(v => (
                                        <button 
                                          key={v}
                                          onClick={() => updateQuestion(q.id, { points: v })}
                                          className={`w-10 py-1.5 rounded-lg text-[10px] font-black transition-all ${q.points === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex flex-1 w-full md:w-auto">
                                <div className="space-y-1.5 w-full">
                                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Correct Answer Index</label>
                                   <input 
                                     className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500"
                                     placeholder="e.g. Option A (or string for objective)..."
                                     value={Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                                     onChange={e => updateQuestion(q.id, { correctAnswer: q.type === 'checkbox' ? e.target.value.split(',').map(s => s.trim()) : e.target.value })}
                                   />
                                </div>
                              </div>
                           </div>
                        </div>
                    </div>
                  )) : (
                    <div className="py-32 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-[4rem] border-4 border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl ring-8 ring-slate-100">
                            <PlusCircle size={48} className="text-slate-200" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Question Pool Void</h4>
                        <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest max-w-xs leading-relaxed">
                          Initialize your assessment by selecting a question type from the control palette.
                        </p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Palette (Right) */}
          <div className="lg:col-span-4 space-y-6 sticky top-[112px]">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
               <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                     <Settings2 size={16} className="text-indigo-600" /> Control Palette
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                     {[
                       { type: 'radio' as const, label: 'Single Choice (Radio)', icon: CircleDot, desc: 'Mutually exclusive selection' },
                       { type: 'checkbox' as const, label: 'Multi-Choice (Check)', icon: CheckSquare, desc: 'Multiple concurrent selections' },
                       { type: 'objective' as const, label: 'Objective Response', icon: Type, desc: 'Short-form text verification' },
                       { type: 'image' as const, label: 'Image Identification', icon: ImageIcon, desc: 'Visual recognition node' },
                       { type: 'video' as const, label: 'Instructional Video', icon: Video, desc: 'Observational analysis node' }
                     ].map(item => (
                       <button 
                         key={item.type}
                         onClick={() => addQuestion(item.type)}
                         className="flex items-center gap-5 p-4 rounded-2xl border-2 border-slate-50 bg-slate-50/50 hover:bg-white hover:border-indigo-500 hover:shadow-xl hover:-translate-y-0.5 transition-all group text-left"
                       >
                         <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm group-hover:bg-indigo-50 transition-colors">
                           <item.icon size={20} className="text-indigo-600" />
                         </div>
                         <div className="min-w-0">
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{item.label}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{item.desc}</p>
                         </div>
                         <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={16} className="text-indigo-500" />
                         </div>
                       </button>
                     ))}
                  </div>
               </div>

               <div className="pt-8 border-t border-slate-100">
                  <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden group shadow-2xl">
                     {/* Added missing Activity icon import */}
                     <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><Activity size={64}/></div>
                     <div className="relative z-10 space-y-4">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">Aggregate Score Node</p>
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-4xl font-black tracking-tighter">{questions.reduce((a, b) => a + b.points, 0)}</span>
                                <span className="text-xs uppercase ml-1 opacity-50">Points</span>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-indigo-400">{questions.length}</p>
                                <p className="text-[8px] font-bold uppercase opacity-50 tracking-widest">Nodes</p>
                            </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
                  {/* Added missing Info icon import */}
                  <Info size={24} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase tracking-tight">
                    Assessment logic is synchronized with <span className="text-blue-900 font-black">HACCP Training Modules</span>. Ensure correct answer mapping for automated results.
                  </p>
               </div>
            </div>
          </div>
        </div>
      ) : (
        /* Preview View */
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-2xl space-y-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
                
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">{quizTitle || "Untitled Assessment"}</h2>
                    <p className="text-sm font-medium text-slate-500 italic max-w-2xl mx-auto">"{quizInstructions || "No instructions provided."}"</p>
                    <div className="flex justify-center gap-6 pt-4">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Weight</span>
                            <span className="text-xl font-black text-slate-800">{questions.reduce((a, b) => a + b.points, 0)} Pts</span>
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Questions</span>
                            <span className="text-xl font-black text-slate-800">{questions.length} Items</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {questions.map((q, idx) => (
                        <div key={q.id} className="space-y-6">
                            <div className="flex items-center gap-4">
                                <span className="text-lg font-black text-indigo-600">Q{(idx + 1).toString().padStart(2, '0')}</span>
                                <div className="h-px bg-slate-100 flex-1" />
                            </div>
                            <h4 className="text-xl font-bold text-slate-800">{q.text}</h4>
                            
                            {(q.type === 'image' && q.mediaUrl) && (
                                <div className="rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-xl max-h-96">
                                    <img src={q.mediaUrl} className="w-full h-full object-cover" alt="Q-Media" />
                                </div>
                            )}

                            {(q.type === 'video' && q.mediaUrl) && (
                                <div className="aspect-video bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white overflow-hidden shadow-2xl relative group">
                                    {/* Added missing Play icon import */}
                                    <div className="p-6 bg-white/10 rounded-full backdrop-blur-md group-hover:scale-110 transition-transform">
                                        <Play size={40} fill="currentColor" />
                                    </div>
                                    <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest opacity-40">Instructional Playback Zone</p>
                                </div>
                            )}

                            {q.type === 'objective' ? (
                                <input 
                                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-bold focus:border-indigo-400 focus:bg-white outline-none transition-all shadow-inner"
                                    placeholder="Type your response here..."
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {q.options.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-4 p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-indigo-300 transition-all cursor-pointer group">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 transition-all ${q.type === 'checkbox' ? 'bg-white border-slate-200 group-hover:border-emerald-500' : 'bg-white border-slate-200 rounded-full group-hover:border-blue-500'}`}>
                                                {String.fromCharCode(65 + oIdx)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{opt || `Option ${oIdx + 1}`}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-12 text-center">
                    <button className="px-20 py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                        Start Simulation
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default QuizCreator;