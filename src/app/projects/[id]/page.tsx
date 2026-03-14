"use client";

import { useState, useRef, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, ImageIcon, Send, Paperclip, Play, Square, ChevronDown, Pause } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Message {
    id: string;
    sender: "client" | "admin";
    content: string;
    type: "text" | "audio" | "image" | "video";
    url?: string;
    timestamp: Date;
    is_edited?: boolean;
    is_deleted?: boolean;
    original_content?: string;
}

const formatPlaybackTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const CustomAudioPlayer = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            const newTime = (Number(e.target.value) / 100) * audioRef.current.duration;
            audioRef.current.currentTime = newTime;
            setProgress(Number(e.target.value));
        }
    };

    return (
        <div className="flex items-center gap-3 w-full" style={{ background: "rgba(0,0,0,0.05)", padding: "12px", borderRadius: "12px" }}>
            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />
            <button
                onClick={togglePlay}
                className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                style={{ border: "2px solid black", boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
            >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
            </button>
            <div className="flex-1 flex flex-col justify-center gap-2">
                <div className="flex justify-between items-center text-xs font-bold opacity-70">
                    <span>Voice Note</span>
                    <span>{formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}</span>
                </div>
                <div className="relative w-full h-3 bg-zinc-300/50 rounded-full overflow-hidden flex items-center group cursor-pointer border border-zinc-400">
                    <div 
                        className="absolute top-0 left-0 h-full bg-black rounded-full pointer-events-none"
                        style={{ width: `${isNaN(progress) ? 0 : progress}%` }}
                    />
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={isNaN(progress) ? 0 : progress} 
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
};

const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0); // Initialize with 0 for safety

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');

        if (!canvasCtx) return;

        const draw = () => {
            const WIDTH = canvas.width;
            const HEIGHT = canvas.height;

            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

            const barWidth = (WIDTH / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                canvasCtx.fillStyle = 'rgb(255, 255, 255)';
                canvasCtx.fillRect(x, HEIGHT / 2 - barHeight / 2, barWidth, barHeight || 2); // Minimum height of 2px
                x += barWidth + 1;
            }
        };

        draw();

        return () => {
            // Check properly before cancelling
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioCtx.state !== 'closed') {
                audioCtx.close().catch(console.error);
            }
        };
    }, [stream]);

    return <canvas ref={canvasRef} width="150" height="40" className="opacity-90" />;
};

export default function ProjectChat({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<"client" | "admin">("client");
    const [projectTitle, setProjectTitle] = useState<string>("Loading...");
    const [projectStatus, setProjectStatus] = useState<string>("Cooking");

    // ── ADMIN Guard ──────────────────────────────────────────────
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    useEffect(() => {
        const loadData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                if (user.email === ADMIN_EMAIL) setCurrentUserRole("admin");
            }

            const { data: projectData } = await supabase
                .from('projects')
                .select('title, status')
                .eq('id', id)
                .single();
            if (projectData) {
                setProjectTitle(projectData.title);
                if (projectData.status) setProjectStatus(projectData.status);
            }

            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: true });

            const defaultMessage: Message = {
                id: "default-1",
                sender: "admin",
                content: "Hey! Project received. I'm reviewing the details now — will start cooking tomorrow 🔥",
                type: "text",
                timestamp: new Date(Date.now() - 100000)
            };

            if (data && data.length > 0) {
                setMessages([
                    defaultMessage,
                    ...data.map(msg => ({
                        id: msg.id,
                        sender: msg.sender_role as "client" | "admin",
                        // Always derive display content from flags, not raw column (survives refresh)
                        content: msg.is_deleted ? "This message was deleted" : (msg.content || "Attachment"),
                        type: msg.file_type as "text" | "audio" | "image" | "video",
                        url: msg.is_deleted ? undefined : msg.file_url,
                        timestamp: new Date(msg.created_at),
                        is_edited: msg.is_edited,
                        is_deleted: msg.is_deleted,
                        original_content: msg.original_content,
                    }))
                ]);
            } else {
                setMessages([defaultMessage]);
            }
        };

        loadData();

        const channel = supabase
            .channel(`messages_${id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${id}` }, (payload) => {
                const newMsg = payload.new;
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, {
                        id: newMsg.id,
                        sender: newMsg.sender_role as "client" | "admin",
                        content: newMsg.content || "Attachment",
                        type: newMsg.file_type as "text" | "audio" | "image" | "video",
                        url: newMsg.file_url,
                        timestamp: new Date(newMsg.created_at),
                        is_edited: newMsg.is_edited,
                        is_deleted: newMsg.is_deleted,
                        original_content: newMsg.original_content,
                    }];
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` }, (payload) => {
                const updatedProject = payload.new;
                if (updatedProject.status) {
                    setProjectStatus(updatedProject.status);
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `project_id=eq.${id}` }, (payload) => {
                const updatedMsg = payload.new;
                setMessages(prev => prev.map(m => m.id === updatedMsg.id ? {
                    ...m,
                    content: updatedMsg.content || "Attachment",
                    is_edited: updatedMsg.is_edited,
                    is_deleted: updatedMsg.is_deleted,
                    original_content: updatedMsg.original_content,
                } : m));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, supabase]);

    const [inputText, setInputText] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setRecordingStream(stream);
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                const audioUrl = URL.createObjectURL(audioBlob);
                if (recordingStream) {
                    recordingStream.getTracks().forEach((track) => track.stop());
                }
                setRecordingStream(null);
                
                if (!userId) return;

                const tempId = crypto.randomUUID();
                const newMessage: Message = {
                    id: tempId,
                    sender: currentUserRole,
                    content: "Voice Note",
                    type: "audio",
                    url: audioUrl,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, newMessage]);
                
                // Upload to Supabase Storage
                const filePath = `${id}/chat/${Date.now()}_voice_note.webm`;
                const { data: uploadData } = await supabase.storage.from('project-files').upload(filePath, audioBlob, { upsert: true });
                
                if (uploadData) {
                    const { data: publicUrlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                    await supabase.from('messages').insert({
                        id: tempId,
                        project_id: id,
                        sender_id: userId,
                        sender_role: currentUserRole,
                        content: "Voice Note",
                        file_url: publicUrlData.publicUrl,
                        file_type: 'audio'
                    });
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
        } catch (err) {
            alert("Microphone access denied. Allow mic permissions and try again.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleSendText = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputText.trim() || !userId) return;
        
        const tempId = crypto.randomUUID();
        const text = inputText;
        setInputText("");
        
        setMessages((prev) => [
            ...prev,
            { id: tempId, sender: currentUserRole, content: text, type: "text", timestamp: new Date() },
        ]);

        await supabase.from('messages').insert({
            id: tempId,
            project_id: id,
            sender_id: userId,
            sender_role: currentUserRole,
            content: text,
            file_type: 'text'
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        
        const type = file.type.startsWith("video/") ? "video" : "image";
        const tempId = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        
        setMessages((prev) => [
            ...prev,
            { id: tempId, sender: currentUserRole, content: file.name, type: type as "image" | "video", url, timestamp: new Date() },
        ]);
        
        e.target.value = ""; // Reset input

        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${id}/chat/${Date.now()}_${safeName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage.from('project-files').upload(filePath, file, { upsert: true });
        if (uploadError) console.error('[UPLOAD ERROR]', uploadError.message);
        if (uploadData || !uploadError) {
            const { data: publicUrlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
            await supabase.from('messages').insert({
                id: tempId,
                project_id: id,
                sender_id: userId,
                sender_role: currentUserRole,
                content: file.name,
                file_url: publicUrlData.publicUrl,
                file_type: type
            });
        }
    };

    const formatTime = (s: number) =>
        `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState<string>("");
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Close menu when clicking outside (simple approach: close on scroll or any message click)
    useEffect(() => {
        const handleClick = () => setActiveMenuId(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    const handleDelete = async (msgId: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        // Optimistic UI update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, original_content: m.content, content: "This message was deleted", url: undefined } : m));
        
        console.log('[DELETE ATTEMPT] msgId:', msgId, 'msg object:', msg);
        const { data, error } = await supabase.from('messages').update({ 
            is_deleted: true, 
            original_content: msg.content, 
            content: "This message was deleted" 
        }).eq('id', msgId).select();

        if (error) {
            console.error('[DELETE ERROR]', error.message, error.code, error.details);
        } else {
            console.log('[DELETE SUCCESS]', data);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingMsgId || !editContent.trim()) {
            setEditingMsgId(null);
            return;
        }

        const msg = messages.find(m => m.id === editingMsgId);
        if (!msg) return;

        const newContent = editContent.trim();
        const original = msg.original_content || msg.content;

        // Optimistic
        setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, is_edited: true, content: newContent, original_content: original } : m));
        setEditingMsgId(null);

        const { data, error } = await supabase.from('messages').update({ 
            is_edited: true, 
            content: newContent, 
            original_content: original 
        }).eq('id', editingMsgId).select();

        if (error) {
            console.error('[EDIT ERROR]', error.message, error.code, error.details);
        } else {
            console.log('[EDIT SUCCESS]', data);
        }
    };

    return (
        <div className="h-[100dvh] w-full overflow-hidden bg-black text-white font-sans flex flex-col">
            {/* Top Bar */}
            <div
                className="flex items-center justify-between px-4 md:px-8 py-4 shrink-0 bg-black z-10 relative"
                style={{ borderBottom: "2px solid #27272a" }}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="text-zinc-500 hover:text-white font-bold text-sm transition-colors"
                    >
                        ← Back
                    </button>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-black uppercase tracking-tighter truncate max-w-[150px] sm:max-w-none">
                            Project: <span style={{ color: "#E0FF00" }}>{projectTitle}</span>
                        </h1>
                    </div>
                </div>
                <span
                    className="px-3 py-1 text-xs font-black uppercase tracking-wider"
                    style={{ backgroundColor: "#8B5CF6", color: "#000", border: "2px solid black", borderRadius: "12px", boxShadow: "2px 2px 0px 0px black" }}
                >
                    {projectStatus}
                </span>
            </div>

            {/* Messages Area - This is what scrolls */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 w-full h-full relative">
                <div className="max-w-4xl mx-auto space-y-4 pb-4">
                {messages.map((msg) => {
                    const isCurrentUser = msg.sender === currentUserRole;
                    return (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className="max-w-[85%] md:max-w-[65%] p-4 group"
                                style={{
                                    backgroundColor: isCurrentUser ? "#ffffff" : "#18181b",
                                    color: isCurrentUser ? "#000000" : "#ffffff",
                                    border: "2px solid black",
                                    boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.8)",
                                    borderRadius: "20px",
                                }}
                            >
                                <div className="text-xs font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
                                    <div className="opacity-40">
                                        {isCurrentUser ? "You" : (currentUserRole === "admin" ? "Client" : "Dev")} •{" "}
                                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        {msg.is_edited && !msg.is_deleted && " (Edited)"}
                                    </div>
                                    
                                    {isCurrentUser && !msg.is_deleted && (
                                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)} 
                                                className="opacity-50 hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded-full"
                                            >
                                                <ChevronDown className="w-4 h-4 text-black" />
                                            </button>
                                            
                                            <AnimatePresence>
                                                {activeMenuId === msg.id && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="absolute right-0 top-full mt-1 w-24 bg-white text-black border-[2px] border-black rounded-lg z-20 overflow-hidden flex flex-col"
                                                        style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
                                                    >
                                                        {msg.type === "text" && (
                                                            <button 
                                                                onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuId(null); }} 
                                                                className="px-3 py-2 text-left text-sm font-bold hover:bg-zinc-100"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => { handleDelete(msg.id); setActiveMenuId(null); }} 
                                                            className={`px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 ${msg.type === "text" ? "border-t border-zinc-200" : ""}`}
                                                        >
                                                            Delete
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>

                                {editingMsgId === msg.id ? (
                                    <div className="flex flex-col gap-2 mt-2">
                                        <textarea 
                                            value={editContent} 
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full bg-zinc-100 border-2 border-zinc-300 p-2 rounded-xl text-black"
                                            rows={2}
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setEditingMsgId(null)} className="text-xs font-bold opacity-60 hover:opacity-100">Cancel</button>
                                            <button onClick={handleSaveEdit} className="text-xs font-bold text-blue-600 hover:text-blue-800">Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {msg.type === "text" && (
                                            <p className={`text-base font-medium leading-relaxed ${msg.is_deleted ? 'italic opacity-60' : ''}`}>
                                                {msg.content}
                                            </p>
                                        )}

                                        {/* Admin specific view for edited/deleted original content */}
                                        {currentUserRole === "admin" && (msg.is_edited || msg.is_deleted) && msg.original_content && (
                                            <div className="mt-2 p-2 bg-red-100/10 border border-red-500/30 rounded-xl text-xs opacity-70">
                                                <span className="font-bold text-red-400">Original: </span>
                                                {msg.original_content}
                                            </div>
                                        )}

                                        {!msg.is_deleted && msg.type === "audio" && msg.url && (
                                            <CustomAudioPlayer url={msg.url} />
                                        )}

                                        {!msg.is_deleted && msg.type === "image" && msg.url && (
                                            <img
                                                src={msg.url}
                                                alt="Shared image"
                                                className="rounded-xl mt-2 w-full max-h-[300px] object-cover"
                                                style={{ border: "2px solid black" }}
                                            />
                                        )}

                                        {!msg.is_deleted && msg.type === "video" && msg.url && (
                                            <video
                                                src={msg.url}
                                                controls
                                                className="rounded-xl mt-2 w-full max-h-[300px] bg-black"
                                                style={{ border: "2px solid black" }}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
                </div>
            </div>

            {/* Input Bar - Sticks to bottom via flex */}
            <div
                className="shrink-0 p-4 pb-6 bg-black z-10 relative w-full"
                style={{ borderTop: "2px solid #27272a" }}
            >
                <div className="max-w-4xl mx-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                    />

                    <form onSubmit={handleSendText} className="flex items-end gap-3">
                        {/* Text Area */}
                        <div
                            className="relative flex-1"
                            style={{
                                background: "#18181b",
                                border: `2px solid ${isRecording ? "#ef4444" : "#3f3f46"}`,
                                borderRadius: "20px",
                                boxShadow: "3px 3px 0px 0px rgba(255,255,255,0.05)",
                                transition: "border-color 0.2s",
                            }}
                        >
                            <AnimatePresence>
                                {isRecording && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-between px-5 z-10 text-white font-bold"
                                        style={{ background: "#ef4444", borderRadius: "18px" }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <AudioVisualizer stream={recordingStream} />
                                            <span className="tabular-nums">{formatTime(recordingTime)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white"
                                            style={{ background: "#000", borderRadius: "12px", border: "2px solid white" }}
                                        >
                                            <Square className="w-4 h-4 fill-current" /> Stop
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Send a message... (Enter to send, Shift+Enter for new line)"
                                className="w-full bg-transparent p-4 min-h-[56px] max-h-[120px] resize-none outline-none text-white placeholder:text-zinc-600 font-medium text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendText();
                                    }
                                }}
                            />

                            <div className="flex items-center gap-1 px-3 pb-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                                    title="Attach file"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                                    title="Upload image/video"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                            <motion.button
                                type="submit"
                                whileHover={{ y: -2, x: -2 }}
                                whileTap={{ y: 2, x: 2 }}
                                disabled={!inputText.trim()}
                                className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center font-bold disabled:opacity-40"
                                style={{
                                    backgroundColor: "#E0FF00",
                                    border: "2px solid black",
                                    boxShadow: "3px 3px 0px 0px black",
                                    borderRadius: "14px",
                                }}
                            >
                                <Send className="w-5 h-5 text-black" />
                            </motion.button>

                            <motion.button
                                type="button"
                                whileHover={{ y: -2, x: -2 }}
                                whileTap={{ y: 2, x: 2 }}
                                onClick={isRecording ? stopRecording : startRecording}
                                className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center"
                                style={{
                                    backgroundColor: isRecording ? "#ef4444" : "#8B5CF6",
                                    border: "2px solid black",
                                    boxShadow: "3px 3px 0px 0px black",
                                    borderRadius: "14px",
                                }}
                            >
                                {isRecording ? (
                                    <Square className="w-5 h-5 text-white fill-current" />
                                ) : (
                                    <Mic className="w-5 h-5 text-black" />
                                )}
                            </motion.button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
