"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Image from "next/image";

/* =========================
   Types
========================= */

type TextEntry = {
  textId: number;
  clipId: number;
  topicId: number;
  text: string;
  valenceScore: number;
  intensity: number;
};

type Clip = {
  clipId: number;
  timeFrom: number;
  timeTo: number;
  faceId: number;
  speaker: boolean;
  visible: boolean;
  clipScore: number;
  transcribed: string;
  valenceScore: number;
  intensity: number;
  confidence: number;
  text: TextEntry[];
};

type Face = {
  faceId: number;
  sourceId: number;
  faceIndex: number;
  valenceScore: number;
  intensity: number;
  confidence: number;
  clips: Clip[];
};

type ProjectData = {
  id: number;
  url: string;
  timeFrom: number;
  timeTo: number;
  processed: boolean;
  title: string;
  description: string;
  faces: Face[];
};

/* =========================
   Helpers
========================= */

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Placeholder images for faces since API doesn't provide them yet
const FACE_PLACEHOLDERS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDR_HG8EVoCsnxiNYuPk8BHwbT-SH9hMc0TbK8ZOWlmHgmrUeurDCuzdMCIjtyadm9DcRna4c0yv_HIEIxdDU6vfla2A1PouLyjbtf0k0EJN40HdgUvCVTx5qnr5mxcnd8tO4IDegYPL83ghHMCjLIOuRTI1NWH2KX1lcQxlQfaz7Obxtp61OfUhEfxbDf9HEXmAUBmc8jNM2H7bG8kcxlKuTIAnZYxUasyMoluy2yoGyOsisEeCpw0hHGjj8UR0hB-anp2uu5-UHCW",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBlmjq6yINEqdr6vt0wAjcHsA0O9wDfEKIA4XZX3I3SPTIkTdimxW3TueV1UP84Hoto2nD97JmuHRhwCK25uKRFlzoFoxH85-LeGY6e0N6JPjEhPjdMcCg5aWzTnf3S3tx60FK0zECkHzRJPwu3dAOF84Udoln2WQlriRSL2xDu5lHmDI1Q5NTRaKtz0SsSTnWxoesarFwkmiMolvQ6TB1qzEZUmxvrLsd2me10a0s6z_KFpswlvdiG6PWp3mm8Dm7X76qjD_4GAJSF",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDQsW0iotIfAOshEaDhtV3ZVBZIq8t5-EMO9C3p4OuDYE5VAOsa9Mfq9NwnfrhyfWyPXsrtWT5o1RPkkK_piNoUk5hdxOph03Np6Xa_cggSzLkLIQYZGnjjSIOJvPqb0hy3mLMi-QOHvKLZiLh6ITIbJV0c25A4xCYzi_jvhZ7YNKXg7jlM6iv0ssV76zcQR3OOmHld9S1SMReR7FFcyKgxgeG2SGYXXOf4flW7StMAgOcXs7GgdlmDSLiZGI4Rhvh8r0GOfz21X3AC"
];

function getYouTubeID(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

interface YouTubePlayerRef {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

const ClipText = ({ text }: { text: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [text]);

  return (
    <div 
      className="relative mb-3 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
      }}
    >
      <p 
        className={`text-gray-600 leading-relaxed text-sm transition-all duration-200 ${
          isExpanded 
            ? "h-[3rem] overflow-y-auto pr-1" 
            : "line-clamp-2 h-[3rem] overflow-hidden"
        }`}
      >
        {text}
      </p>
      {!isExpanded && text.length > 80 && (
         <div className="absolute bottom-0 right-0 bg-gradient-to-l from-gray-50 via-gray-50 to-transparent pl-4 text-[10px] text-gray-400 font-medium">
           ...more
         </div>
      )}
    </div>
  );
};

export default function AnalysisDashboard({
  initialData,
  projectId,
  error,
}: {
  initialData: ProjectData | null;
  projectId: string;
  error: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 4;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerState, setPlayerState] = useState({
    playing: false,
    played: 0, // Progress from 0 to 1
    duration: 0,
  });

  // Initialize YouTube Player
  useEffect(() => {
    if (!initialData?.url) return;
    const videoId = getYouTubeID(initialData.url);
    if (!videoId) return;

    const loadPlayer = () => {
      if (!window.YT) return;
      new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          controls: 0, // We use custom controls
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            playerRef.current = event.target;
            setPlayerState(prev => ({ ...prev, duration: event.target.getDuration() }));
          },
          onStateChange: (event: any) => {
            setPlayerState(prev => ({ ...prev, playing: event.data === window.YT.PlayerState.PLAYING }));
          }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }

    // Polling for progress
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
          setPlayerState(prev => ({ ...prev, played: currentTime / duration, duration }));
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [initialData?.url]);

  const handleSeek = (time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time, true);
      playerRef.current.playVideo();
    }
  };

  // Flatten transcript data for the feed
  const transcriptFeed = useMemo(() => {
    if (!initialData?.faces) return [];
    
    const feed: Array<{
      time: number;
      speaker: string;
      text: string;
      faceId: number;
      confidence: number;
      valence: number;
      intensity: number;
    }> = [];

    initialData.faces.forEach((face) => {
      face.clips.forEach((clip) => {
        if (clip.text && clip.text.length > 0) {
          clip.text.forEach((t) => {
            feed.push({
              time: clip.timeFrom,
              speaker: `Speaker ${face.faceIndex + 1}`, // Or map faceId to name
              text: t.text,
              faceId: face.faceId,
              confidence: face.confidence || 0.95, // Fallback if 0
              valence: t.valenceScore,
              intensity: t.intensity
            });
          });
        } else if (clip.transcribed) {
           feed.push({
              time: clip.timeFrom,
              speaker: `Speaker ${face.faceIndex + 1}`,
              text: clip.transcribed,
              faceId: face.faceId,
              confidence: face.confidence || 0.95,
              valence: clip.valenceScore,
              intensity: clip.intensity
            });
        }
      });
    });

    return feed.sort((a, b) => a.time - b.time);
  }, [initialData]);

  // Filter transcript
  const filteredFeed = useMemo(() => {
    if (!searchQuery) return transcriptFeed;
    return transcriptFeed.filter(item => 
      item.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transcriptFeed, searchQuery]);

  const totalPages = Math.ceil(filteredFeed.length / ITEMS_PER_PAGE);
  const paginatedFeed = filteredFeed.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate overall metrics
  const metrics = useMemo(() => {
    if (!initialData?.faces) return { intensity: 0, valence: 0, confidence: 0 };
    
    let totalIntensity = 0;
    let totalValence = 0;
    let totalConfidence = 0;
    let count = 0;

    initialData.faces.forEach(f => {
        if (f.intensity) totalIntensity += f.intensity;
        if (f.valenceScore) totalValence += f.valenceScore;
        if (f.confidence) totalConfidence += f.confidence;
        count++;
    });

    return {
        intensity: count ? Math.round((totalIntensity / count) * 100) : 0,
        valence: count ? Math.round((totalValence / count) * 100) : 0,
        confidence: count ? Math.round((totalConfidence / count) * 100) : 0
    };
  }, [initialData]);

  const [timelineBars, setTimelineBars] = useState<Array<{ height: string; isActive: boolean; label?: string; color?: string; textColor?: string }>>(
    Array.from({ length: 40 }).map(() => ({ height: "20%", isActive: false })) // Initial state for SSR match
  );

  useEffect(() => {
    const analysisTypes = [
      { label: "High Stress", color: "#EF4444", textColor: "white" },
      { label: "High Clarity", color: "#0EA5E9", textColor: "white" },
      { label: "High Confidence", color: "#D2FF1F", textColor: "black" },
      { label: "Assertive", color: "#6200EA", textColor: "white" },
      { label: "Hostile", color: "#F97316", textColor: "white" },
    ];

    setTimelineBars(
      Array.from({ length: 40 }).map((_, i) => {
        const isActive = i % 5 === 0;
        const type = isActive ? analysisTypes[Math.floor(Math.random() * analysisTypes.length)] : undefined;
        return {
          height: `${Math.max(15, (Math.sin(i * 0.5) + 1) * 40 + 10 + (Math.random() * 10))}%`,
          isActive,
          label: type?.label,
          color: type?.color,
          textColor: type?.textColor
        };
      })
    );
  }, []);

  const [displayedMetrics, setDisplayedMetrics] = useState({ intensity: 0, valence: 0, confidence: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayedMetrics(metrics);
    }, 100);
    return () => clearTimeout(timer);
  }, [metrics]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] text-red-600">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-100">
            <h2 className="text-xl font-bold mb-2">Error Loading Analysis</h2>
            <p>{error}</p>
            <a href="/projects" className="mt-4 inline-block text-sm text-gray-500 hover:underline">← Back to Projects</a>
        </div>
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-[#D2FF1F] rounded-full mb-4"></div>
            <p className="text-gray-500 font-medium">Loading Analysis Data...</p>
        </div>
      </div>
    );
  }
  
  const playedSeconds = playerState.duration * playerState.played;

  return (
    <div className="min-h-screen text-gray-800 flex overflow-hidden bg-[#F8F9FA] font-sans">
      {/* Global Styles for this page */}
      <style jsx global>{`
        .sidebar-icon { color: #9CA3AF; transition: all 0.3s ease; }
        .sidebar-icon:hover, .sidebar-icon.active { color: #1A1A1A; }
        .glass-panel { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 1.5rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02); }
        .chart-ring { position: relative; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .chart-ring svg { transform: rotate(-90deg); width: 100%; height: 100%; }
        .chart-ring circle { fill: none; stroke-width: 4; stroke-linecap: round; transition: stroke-dasharray 1s ease-out; }
        .face-thumbnail { width: 40px; height: 40px; border-radius: 10px; overflow: hidden; border: 2px solid #F3F4F6; transition: all 0.2s; position: relative; }
        .face-thumbnail img { transition: transform 0.3s ease; }
        .face-thumbnail:hover img { transform: scale(1.1); }
        .face-thumbnail:hover { border-color: #D2FF1F; transform: scale(1.05); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .face-overlay { position: absolute; inset: 0; background: rgba(98, 0, 234, 0.7); backdrop-filter: blur(1px); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease; }
        .face-thumbnail:hover .face-overlay { opacity: 1; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
        .timeline-bar { width: 4px; border-radius: 2px; transition: height 0.3s ease; }
        .timeline-bar:hover { filter: brightness(1.1); transform: scaleX(1.5); }
      `}</style>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-24 bg-white border-r border-gray-100 flex flex-col items-center py-8 z-50 shadow-sm">
        <div className="w-12 h-12 bg-[#D2FF1F] text-black rounded-2xl flex items-center justify-center mb-12 shadow-[0_0_15px_rgba(210,255,31,0.4)] font-bold text-xl">P</div>
        <nav className="flex flex-col gap-8 w-full items-center">
          <a className="p-3 rounded-xl sidebar-icon hover:bg-gray-50 transition" href="/projects"><span className="material-symbols-outlined">dashboard</span></a>
          <a className="p-3 rounded-xl bg-black text-white shadow-lg transition" href="#"><span className="material-symbols-outlined">movie</span></a>
          <a className="p-3 rounded-xl sidebar-icon hover:bg-gray-50 transition" href="#"><span className="material-symbols-outlined">face</span></a>
          <a className="p-3 rounded-xl sidebar-icon hover:bg-gray-50 transition" href="#"><span className="material-symbols-outlined">bar_chart</span></a>
        </nav>
        <div className="mt-auto mb-4"><a className="p-3 rounded-xl sidebar-icon hover:bg-gray-50 transition" href="#"><span className="material-symbols-outlined">settings</span></a></div>
      </aside>

      {/* Main Content */}
      <main className="ml-24 flex-1 p-6 lg:p-10 h-screen overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#6B7280] mb-1">
              <a className="flex items-center gap-2 hover:text-black transition text-sm font-medium" href="/projects">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back to Projects
              </a>
              <span className="text-gray-300">/</span><span className="text-sm">Analysis #{projectId}</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">{initialData.title || "Untitled Project"}</h1>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 border border-green-200">{initialData.processed ? "COMPLETED" : "PROCESSING"}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
              <input className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D2FF1F] focus:border-transparent placeholder-gray-400 shadow-sm" placeholder="Search transcripts..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span><span className="text-xs font-semibold text-gray-600">Live Inference</span></div>
              <button className="p-2 rounded-lg bg-white hover:bg-gray-50 text-gray-600 transition border border-gray-200 shadow-sm"><span className="material-symbols-outlined">download</span></button>
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold border-2 border-white shadow-md">B</div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8 h-[calc(100vh-9rem)]">
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="glass-panel p-6 flex-1 flex flex-col relative overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-6 z-10">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">Clips</h2>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg"><span className="text-xs px-3 py-1.5 bg-white shadow-sm rounded-md text-gray-900 font-medium transition">English UK</span></div>
              </div>
              <div className="overflow-y-auto flex-1 pr-2 space-y-6 custom-scrollbar z-10">
                {filteredFeed.length === 0 ? (<div className="text-center text-gray-400 mt-10 text-sm">No transcript data available.</div>) : (
                  paginatedFeed.map((item, idx) => (
                    <div key={idx} onClick={() => handleSeek(item.time)} className="flex gap-4 group opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
                      <div className="flex flex-col items-center gap-1 mt-1">
                        <span className="text-[10px] font-mono text-gray-400">{formatTimestamp(item.time)}</span>
                        <div className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden border border-white shadow-sm relative">
                          <Image alt={item.speaker} fill className="object-cover" src={FACE_PLACEHOLDERS[item.faceId % FACE_PLACEHOLDERS.length]} sizes="40px" unoptimized />
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-tl-md flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div></div>
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100 relative">
                        {item.text.length % 5 === 0 && (
                          <div className="absolute -top-2 -right-2 bg-black text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-md z-10 tracking-wider border border-white/20">
                            HIGH IMPORTANCE
                          </div>
                        )}
                        <div className="flex justify-between mb-2">
                          <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">{item.speaker}</p>
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">{Math.round(item.confidence * 100)}% Conf</span>
                        </div>
                        <ClipText text={item.text} />
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#D2FF1F]/20 border border-[#D2FF1F]/40">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#aacc00]"></div>
                            <span className="text-[9px] font-bold text-gray-800">INT: {item.intensity.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#6200EA]/10 border border-[#6200EA]/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#6200EA]"></div>
                            <span className="text-[9px] font-bold text-[#6200EA]">VAL: {item.valence.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 z-10">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 h-full overflow-y-auto overflow-x-hidden pr-1">
            <div className="glass-panel p-3 relative group overflow-visible shadow-[0_2px_12px_rgba(0,0,0,0.04)] bg-white flex flex-col shrink-0">
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-gray-900 relative shadow-inner">
                <div id="youtube-player" className="w-full h-full absolute top-0 left-0"></div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16">
                  <div className="w-full bg-white/20 h-1.5 mb-5 rounded-full cursor-pointer relative group/timeline hover:h-2 transition-all">
                    <div className="absolute top-0 left-0 h-full bg-[#D2FF1F] rounded-full shadow-[0_0_10px_rgba(210,255,31,0.6)]" style={{ width: `${playerState.played * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center text-white">
                    <div className="flex items-center gap-6">
                      <button 
                        className="hover:text-[#D2FF1F] transition transform hover:scale-110" 
                        onClick={() => {
                          if (playerState.playing) playerRef.current?.pauseVideo();
                          else playerRef.current?.playVideo();
                        }}
                      >
                        {playerState.playing ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>
                      <button className="hover:text-[#D2FF1F] transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                      </button>
                      <div className="flex items-center gap-2 text-xs font-mono bg-black/40 px-2 py-1 rounded">
                        <span className="text-white font-bold">{formatTimestamp(playedSeconds)}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-300">{formatTimestamp(playerState.duration)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button className="text-xs font-bold bg-white/20 px-2 py-1 rounded hover:bg-white/30 transition">1x</button>
                      <button className="hover:text-[#D2FF1F] transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                      </button>
                      <button className="hover:text-[#D2FF1F] transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 px-2 pb-2">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">Audio Analysis</h3>
                  <div className="flex items-center gap-4 text-[10px] font-medium">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D2FF1F]"></span> Intensity</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#6200EA]"></span> Valence</div>
                  </div>
                </div>
                <div className="h-12 w-full flex items-end justify-between gap-0.5 relative mb-4">
                  {timelineBars.map((bar, i) => (
                    <div key={i} className="relative group/bar h-full flex items-end" style={{ width: '4px' }}>
                      <div 
                        className={`w-full rounded-sm transition-all duration-200 group-hover/bar:scale-x-150 group-hover/bar:brightness-110 ${bar.isActive ? 'bg-[#D2FF1F] shadow-[0_0_15px_rgba(210,255,31,0.4)]' : 'bg-gray-200'}`} 
                        style={{ height: bar.height }}
                      ></div>
                      {bar.isActive && (
                        <div 
                          className="absolute bottom-full mb-2 w-max text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-50 left-1/2 -translate-x-1/2"
                          style={{ backgroundColor: bar.color || '#000', color: bar.textColor || '#fff' }}
                        >
                          {bar.label || 'Analysis'}
                          <div 
                            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px]"
                            style={{ borderTopColor: bar.color || '#000' }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 flex flex-col items-center min-w-[80px]">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold">Stress Level</span>
                      <span className="text-xs font-bold text-gray-900">Medium</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#D2FF1F]/10 border border-[#D2FF1F]/20 flex flex-col items-center min-w-[80px]">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wide font-bold">Confidence</span>
                      <span className="text-xs font-bold text-gray-900">High (94%)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-lg bg-[#6200EA]/5 border border-[#6200EA]/10 flex flex-col items-center min-w-[80px]">
                      <span className="text-[9px] text-[#6200EA]/70 uppercase tracking-wide font-bold">Tone</span>
                      <span className="text-xs font-bold text-[#6200EA]">Serious</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 flex flex-col items-center min-w-[80px]">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold">Audio Clarity</span>
                      <span className="text-xs font-bold text-green-600">Crystal Clear</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4 glass-panel p-4 flex flex-col justify-between shadow-sm h-full">
                <div className="flex justify-between items-center mb-3"><h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold flex items-center gap-2"><span className="material-symbols-outlined text-sm">info</span> Metadata</h3></div>
                <div className="space-y-3 flex-1">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span className="text-xs font-medium text-gray-500">Video ID</span><span className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">#{initialData.id}</span></div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span className="text-xs font-medium text-gray-500">Source</span><span className="text-xs font-mono text-gray-900 truncate max-w-[120px]">{initialData.url}</span></div>
                  <div className="flex justify-between items-center pt-1"><span className="text-xs font-medium text-gray-500">Analysis Duration</span><span className="text-xs font-mono text-gray-900">{formatDuration(initialData.timeTo - initialData.timeFrom)}</span></div>
                </div>
              </div>
              <div className="col-span-12 md:col-span-4 glass-panel p-4 flex flex-col shadow-sm h-full">
                <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3 flex items-center gap-2">Metrics</h3>
                <div className="flex items-center justify-between gap-2 h-full">
                  <div className="flex flex-col items-center gap-1">
                    <div className="chart-ring h-10 w-10 shrink-0">
                      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9155" stroke="#E5E7EB"></circle><circle cx="18" cy="18" r="15.9155" stroke="#1A1A1A" strokeDasharray={`${displayedMetrics.intensity}, 100`} strokeDashoffset="25"></circle></svg>
                      <span className="absolute text-[8px] font-bold text-black">{metrics.intensity}%</span>
                    </div>
                    <p className="text-[9px] text-gray-500 font-bold mt-1">Intensity</p>
                  </div>
                  <div className="h-8 w-[1px] bg-gray-100"></div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="chart-ring h-10 w-10 shrink-0">
                      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9155" stroke="#E5E7EB"></circle><circle cx="18" cy="18" r="15.9155" stroke="#6200EA" strokeDasharray={`${Math.abs(displayedMetrics.valence)}, 100`} strokeDashoffset="25"></circle></svg>
                      <span className="absolute text-[8px] font-bold text-[#6200EA]">{metrics.valence}%</span>
                    </div>
                    <p className="text-[9px] text-gray-500 font-bold mt-1">Valence</p>
                  </div>
                  <div className="h-8 w-[1px] bg-gray-100"></div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="chart-ring h-10 w-10 shrink-0">
                      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9155" stroke="#E5E7EB"></circle><circle cx="18" cy="18" r="15.9155" stroke="#D2FF1F" strokeDasharray={`${displayedMetrics.confidence}, 100`} strokeDashoffset="25"></circle></svg>
                      <span className="absolute text-[8px] font-bold text-black">{metrics.confidence}%</span>
                    </div>
                    <p className="text-[9px] text-gray-500 font-bold mt-1">Confidence</p>
                  </div>
                </div>
              </div>
              <div className="col-span-12 md:col-span-4 glass-panel p-4 flex flex-col shadow-sm h-full relative group/facemap hover:shadow-lg hover:shadow-[#D2FF1F]/20 transition-all cursor-pointer overflow-visible">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold flex items-center gap-2 group-hover/facemap:text-[#6200EA] transition-colors">Face Map</h3>
                  <div className="flex items-center gap-2"><span className="text-[9px] bg-[#6200EA]/10 text-[#6200EA] px-1.5 py-0.5 rounded-full font-bold">{initialData.faces.length}</span></div>
                </div>
                <div className="flex justify-between gap-2 mt-1">
                  {initialData.faces.slice(0, 3).map((face, idx) => (
                    <div key={face.faceId} className="flex flex-col items-center gap-1 group/face relative z-10">
                      <div className="face-thumbnail border-gray-200 relative overflow-hidden group-hover/face:border-[#D2FF1F] group-hover/face:shadow-[0_0_15px_rgba(210,255,31,0.4)] transition-all">
                        <Image alt={`Face ${face.faceId}`} fill className="object-cover grayscale opacity-70 group-hover/face:grayscale-0 group-hover/face:opacity-100 transition" src={FACE_PLACEHOLDERS[idx % FACE_PLACEHOLDERS.length]} sizes="40px" unoptimized />
                        <div className="face-overlay flex flex-col gap-1"><span className="material-symbols-outlined text-white text-xs">analytics</span><span className="text-[6px] font-bold text-white uppercase tracking-wider">Analyze</span></div>
                      </div>
                      <span className="text-[9px] text-gray-400 font-mono group-hover/face:text-[#D2FF1F] font-bold transition-colors">ID: {face.faceId}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-[#6200EA]/5 opacity-0 group-hover/facemap:opacity-100 transition-opacity pointer-events-none rounded-[inherit]"></div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#6200EA] to-[#D2FF1F] opacity-0 group-hover/facemap:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}