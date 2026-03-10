"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { differenceInDays, format } from "date-fns";
import { 
    Plus, Clock, Search, LogOut, MessageSquare, IndianRupee, 
    UploadCloud, X, Play, Square, Mic, Send, Paperclip,
    ChevronRight, File as FileIcon, Pause, Trash2, Bell
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/utils/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitProjectAction } from "@/app/actions/submitProject";

const BASE_PRICE = 2000;
const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID;

export default function CustomerDashboard() {
    const router = useRouter();
    const supabase = createClient();

    // ── Project List State ──────────────────────────────────────────────────
    interface Project {
        id: string;
        title: string;
        category: string;
        status: string;
        created_at: string;
        deadline: string;
    }

    interface Notification {
        id: string;
        message: string;
        description: string;
        time: string;
        projectId?: string;
        read: boolean;
    }

    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [showForm, setShowForm] = useState(false);
    
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null;
        
        const fetchProjects = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoadingProjects(false); return; }
            
            const { data } = await supabase
                .from('projects')
                .select('id, title, category, status, created_at, deadline')
                .eq('client_id', user.id)
                .order('created_at', { ascending: false });
                
            setProjects(data || []);
            setLoadingProjects(false);

            channel = supabase.channel(`customer_projects_${user.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `client_id=eq.${user.id}` }, (payload) => {
                    const updatedProject = payload.new;
                    setProjects(prev => {
                        const oldProject = prev.find(p => p.id === updatedProject.id);
                        if (oldProject && oldProject.status !== updatedProject.status) {
                            toast.info(`Project Update: ${updatedProject.title}`, {
                                description: `Status changed to ${updatedProject.status} 🚀`
                            });
                        }
                        return prev.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p);
                    });
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                    const newMsg = payload.new;
                    if (newMsg.sender_role === 'admin') {
                        setProjects(currentProjects => {
                            if (currentProjects.some(p => p.id === newMsg.project_id)) {
                                toast.message("💬 New Message from Admin", {
                                    description: "Check your project chat!",
                                    action: { label: "View Chat", onClick: () => router.push(`/projects/${newMsg.project_id}`) }
                                });
                            }
                            return currentProjects;
                        });
                    }
                })
                .subscribe();
        };
        fetchProjects();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);
    // ───────────────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        name: "",
        title: "",
        category: "Other",
        description: "",
        links: [] as string[],
        deadline: "",
    });
    const [linkInput, setLinkInput] = useState("");
    const [linkError, setLinkError] = useState("");

    const [files, setFiles] = useState<File[]>([]);
    const [needsReport, setNeedsReport] = useState(false);
    
    // UTR and Payment State
    const [showQR, setShowQR] = useState(false);
    const [utrNumber, setUtrNumber] = useState("");
    const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
    const [paymentReviewing, setPaymentReviewing] = useState(false);

    const [dynamicPrice, setDynamicPrice] = useState(BASE_PRICE);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const calculatePrice = (dateString: string, category: string, report: boolean) => {
        let urgencyPrice = 2000;
        
        if (dateString) {
            const targetDate = new Date(dateString);
            const today = new Date();
            const daysAway = differenceInDays(targetDate, today);

            if (daysAway <= 2) {
                urgencyPrice = 3000;
            } else if (daysAway <= 6) {
                urgencyPrice = 2500;
            } else if (daysAway <= 13) {
                urgencyPrice = 2000;
            } else if (daysAway <= 20) {
                urgencyPrice = 1500;
            } else {
                urgencyPrice = 1000;
            }
        }

        const categoryMultipliers: Record<string, number> = {
            "PPT / Synopsis only": 0.7,
            "Documentation only": 0.8,
            "UI/UX prototype only": 0.9,
            "Mini Project": 1.0,
            "Other": 1.0,
            "Major Project": 1.3,
            "Android / Mobile App": 1.3,
            "Data Science / Analytics": 1.4,
            "IoT / Embedded": 1.4,
            "ML / AI": 1.5
        };

        const multiplier = categoryMultipliers[category] || 1.0;
        let finalPrice = Math.round(urgencyPrice * multiplier);
        if (finalPrice > 3500) finalPrice = 3500;
        
        if (report) finalPrice += 500;

        return finalPrice;
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        setFormData({ ...formData, deadline: newDate });
        setDynamicPrice(calculatePrice(newDate, formData.category, needsReport));
        setShowQR(false); // Reset QR if price factor changes
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCat = e.target.value;
        setFormData({ ...formData, category: newCat });
        setDynamicPrice(calculatePrice(formData.deadline, newCat, needsReport));
        setShowQR(false); // Reset QR if price factor changes
    };

    const handleReportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setNeedsReport(checked);
        setDynamicPrice(calculatePrice(formData.deadline, formData.category, checked));
        setShowQR(false); // Reset QR if price factor changes
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowQR(true);
    };

    const handleFinalSubmit = async () => {
        if(utrNumber.length < 12 && !paymentScreenshot) {
            alert("Please provide the 12-digit UTR number or upload a screenshot to verify payment.");
            return;
        }

        setPaymentReviewing(true);

        const submitData = new FormData();
        
        // Add all text fields
        submitData.append("name", formData.name);
        submitData.append("title", formData.title);
        submitData.append("category", formData.category);
        submitData.append("description", formData.description);
        submitData.append("links", formData.links.join(","));
        submitData.append("deadline", formData.deadline);
        submitData.append("needsReport", needsReport ? "true" : "false");
        submitData.append("totalPrice", dynamicPrice.toString());
        submitData.append("utrNumber", utrNumber);

        // Add Audio
        if (audioBlob) {
            submitData.append("voiceNote", new File([audioBlob], "voice_note.webm", { type: 'audio/webm' }));
        }

        // Add Screenshot
        if (paymentScreenshot) {
            submitData.append("screenshot", paymentScreenshot);
        }

        // Add Attachments
        files.forEach((file, index) => {
            submitData.append(`attachment_${index}`, file);
        });

        console.log("Submitting Project Data to Server...");
        const result = await submitProjectAction(submitData);

        if (result.success && result.projectId) {
            // Once successful, immediately route to the new project
            router.push(`/projects/${result.projectId}`);
        } else {
            console.error("Submission failed:", result.error);
            alert("Failed to create project: " + result.error);
            setPaymentReviewing(false); // Let them try again
        }
    };

    // --- Audio Recording Logic ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Please allow microphone access to record a voice note.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const togglePlayback = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const deleteRecording = () => {
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
    };
    // ----------------------------

    // --- File Input Logic ---
    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize: 10485760, // 10MB
    });

    const removeFile = (indexToRemove: number) => {
        setFiles(files.filter((_, idx) => idx !== indexToRemove));
    };
    // ----------------------------

    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=ProjectDev&am=${dynamicPrice}`;

    return (
        <div className="min-h-screen p-4 md:p-8 font-sans bg-black text-white max-w-7xl mx-auto space-y-6">

            {/* Top Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 p-6 md:p-8 w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                style={{ border: "2px solid #3f3f46", borderBottom: "4px solid #8B5CF6", borderRadius: "24px" }}
            >
                <div>
                    <h1 className="text-4xl md:text-5xl font-black uppercase text-white">
                        {showForm ? "New Project 🍳" : "My Projects 🚀"}
                    </h1>
                    <p className="text-zinc-400 font-medium mt-2 text-lg">
                        {showForm ? "Drop the vision. Get an instant quote. Let's build something crazy." : "Track your projects and chat with the dev."}
                    </p>
                </div>
                <div className="flex items-center gap-4 self-end md:self-auto z-50">
                    <div className="relative" ref={notificationRef}>
                        <button 
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="p-3 bg-black border-2 border-zinc-800 rounded-full hover:bg-zinc-800 transition-colors relative"
                        >
                            <Bell size={20} className="text-zinc-400" />
                            {notifications.filter(n => !n.read).length > 0 && (
                                <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-black"></span>
                            )}
                        </button>
                        
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border-2 border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-left"
                                    style={{ boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}
                                >
                                    <div className="p-4 border-b-2 border-zinc-800 flex justify-between items-center bg-black">
                                        <h3 className="font-black text-white uppercase tracking-wider text-sm">Notifications</h3>
                                        {notifications.filter(n => !n.read).length > 0 && (
                                            <button 
                                                onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))}
                                                className="text-[10px] text-zinc-500 hover:text-[#E0FF00] uppercase font-bold transition-colors"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-zinc-600 font-bold text-sm">No new alerts.</div>
                                        ) : (
                                            notifications.map(n => (
                                                <div 
                                                    key={n.id} 
                                                    onClick={() => {
                                                        setNotifications(prev => prev.map(x => x.id === n.id ? {...x, read: true} : x));
                                                        if (n.projectId) router.push(`/projects/${n.projectId}`);
                                                    }}
                                                    className={`p-4 border-b border-zinc-800 hover:bg-zinc-800 cursor-pointer transition-colors ${!n.read ? 'bg-zinc-800/50' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="font-bold text-white text-sm flex items-center gap-2">
                                                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#E0FF00] shrink-0"></span>}
                                                            {n.message}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500 font-bold mt-0.5">{format(new Date(n.time), 'HH:mm')}</div>
                                                    </div>
                                                    <div className="text-xs text-zinc-400 pl-3.5">{n.description}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-5 py-3 font-black text-sm uppercase tracking-wider transition-all shrink-0"
                        style={{
                            background: showForm ? "#3f3f46" : "#E0FF00",
                            color: showForm ? "#fff" : "#000",
                            border: "2px solid black",
                            borderRadius: "16px",
                            boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
                        }}
                    >
                        {showForm ? <X size={16} /> : <Plus size={16} />}
                        {showForm ? "Cancel" : "New Project"}
                    </button>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* ── PROJECTS LIST VIEW ── */}
                {!showForm && (
                    <motion.div
                        key="projects-list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                    >
                        {loadingProjects ? (
                            <div className="flex items-center justify-center py-20 text-zinc-500 font-bold text-lg">
                                Loading your projects...
                            </div>
                        ) : projects.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-24 text-center"
                            >
                                <div className="text-6xl mb-6">📭</div>
                                <h2 className="text-2xl font-black uppercase text-white mb-2">No projects yet!</h2>
                                <p className="text-zinc-500 mb-8">Hit the button above to submit your first project.</p>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="flex items-center gap-2 px-6 py-3 font-black text-sm uppercase tracking-wider"
                                    style={{ background: "#E0FF00", color: "#000", border: "2px solid black", borderRadius: "16px", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
                                >
                                    <Plus size={18} /> Get Started
                                </button>
                            </motion.div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {projects.map((project, i) => {
                                    const statusColors: Record<string, { bg: string; text: string }> = {
                                        "Cooking": { bg: "#8B5CF6", text: "#fff" },
                                        "In Progress": { bg: "#F97316", text: "#fff" },
                                        "Review": { bg: "#FACC15", text: "#000" },
                                        "Payment Review": { bg: "#3B82F6", text: "#fff" },
                                        "Accepted": { bg: "#10B981", text: "#fff" },
                                        "Rejected": { bg: "#EF4444", text: "#fff" },
                                        "Done": { bg: "#E0FF00", text: "#000" },
                                        "Pending": { bg: "#3f3f46", text: "#fff" },
                                    };
                                    const sc = statusColors[project.status] || { bg: "#3f3f46", text: "#fff" };
                                    return (
                                        <motion.div
                                            key={project.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            onClick={() => router.push(`/projects/${project.id}`)}
                                            className="bg-zinc-900 p-6 flex flex-col gap-4 cursor-pointer hover:bg-zinc-800 transition-colors group"
                                            style={{ border: "2px solid #3f3f46", borderRadius: "20px", boxShadow: "4px 4px 0px 0px rgba(255,255,255,0.05)" }}
                                        >
                                            {/* Category + Status */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{project.category}</span>
                                                <span
                                                    className="px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full"
                                                    style={{ backgroundColor: sc.bg, color: sc.text, border: "2px solid black" }}
                                                >
                                                    {project.status}
                                                </span>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-xl font-black text-white leading-tight group-hover:text-[#E0FF00] transition-colors">
                                                {project.title}
                                            </h3>

                                            {/* Deadline + Date */}
                                            <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    Deadline: {project.deadline ? format(new Date(project.deadline), 'dd MMM yyyy') : 'Not set'}
                                                </span>
                                            </div>

                                            {/* Open Chat CTA */}
                                            <div
                                                className="mt-auto flex items-center justify-between pt-4 border-t border-zinc-800"
                                            >
                                                <span className="flex items-center gap-2 text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">
                                                    <MessageSquare size={16} /> Open Chat
                                                </span>
                                                <ChevronRight size={18} className="text-zinc-600 group-hover:text-[#E0FF00] transition-colors" />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── NEW PROJECT FORM ── */}
                {showForm && (
                    <motion.div
                        key="new-project-form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.25 }}
                    >

            {/* Main Grid Structure (3 Columns) */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* Left Side (Spans 2 Columns) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* The Core Details Box */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-zinc-900 p-6 md:p-8"
                        style={{ border: "2px solid #3f3f46", boxShadow: "4px 4px 0px 0px rgba(255,255,255,0.05)", borderRadius: "24px" }}
                    >
                        <h2 className="text-2xl font-black uppercase text-white mb-6 border-b-2 border-zinc-800 pb-4">The Core Details</h2>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Your Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Vibe Master"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Project Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Next-Gen AI Dashboard"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="category">Project Category</Label>
                                <select
                                    id="category"
                                    value={formData.category}
                                    onChange={handleCategoryChange}
                                    className="w-full bg-zinc-950 border-2 border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-[#E0FF00] transition-colors appearance-none font-medium cursor-pointer"
                                    style={{ boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}
                                >
                                    <option value="Mini Project">Mini Project</option>
                                    <option value="Major Project">Major Project</option>
                                    <option value="Android / Mobile App">Android / Mobile App</option>
                                    <option value="Data Science / Analytics">Data Science / Analytics</option>
                                    <option value="ML / AI">ML / AI</option>
                                    <option value="IoT / Embedded">IoT / Embedded</option>
                                    <option value="UI/UX prototype only">UI/UX prototype only</option>
                                    <option value="PPT / Synopsis only">PPT / Synopsis only</option>
                                    <option value="Documentation only">Documentation only</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">The Vision (Description)</Label>
                                <Textarea
                                    id="description"
                                    placeholder="What are we cooking exactly? Be as detailed as you want."
                                    required
                                    className="min-h-[120px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* The Logistics Box */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-zinc-900 p-6 md:p-8"
                        style={{ border: "2px solid #3f3f46", boxShadow: "4px 4px 0px 0px rgba(255,255,255,0.05)", borderRadius: "24px" }}
                    >
                        <h2 className="text-2xl font-black uppercase text-white mb-6 border-b-2 border-zinc-800 pb-4">The Logistics</h2>
                        <div className="space-y-6">

                            {/* File Uploads */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">Attachments (Images, Docs, References)</Label>
                                <div
                                    {...getRootProps()}
                                    className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragActive ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-950'
                                        }`}
                                >
                                    <input {...getInputProps()} />
                                    <Paperclip size={24} className="text-zinc-500 mb-2" />
                                    <p className="text-sm font-medium text-zinc-300">Drag & drop files here, or click to select files</p>
                                    <p className="text-xs text-zinc-600 mt-1">Max 10MB per file</p>
                                </div>

                                {/* File List */}
                                <AnimatePresence>
                                    {files.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 flex gap-2 flex-wrap"
                                        >
                                            {files.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                                                    <FileIcon size={14} className="text-[#E0FF00]" />
                                                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(idx)}
                                                        className="text-zinc-400 hover:text-red-400 ml-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="links">External Links (Figma, GitHub, YouTube)</Label>
                                <div
                                    className="flex flex-wrap gap-2 p-3 bg-zinc-950 border-2 border-zinc-800 rounded-xl focus-within:border-[#E0FF00] transition-colors min-h-[52px] items-center"
                                >
                                    {formData.links.map((link, i) => (
                                        <span
                                            key={i}
                                            className="flex items-center gap-1 px-3 py-1 bg-zinc-800 border border-zinc-600 rounded-full text-xs font-medium max-w-[200px]"
                                        >
                                            <span className="truncate">{link.replace(/^https?:\/\//, '')}</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(f => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}
                                                className="text-zinc-400 hover:text-red-400 shrink-0 ml-1"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        id="links"
                                        value={linkInput}
                                        onChange={(e) => { setLinkInput(e.target.value); setLinkError(""); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                const val = linkInput.trim();
                                                if (!val) return;
                                                try {
                                                    new URL(val.startsWith('http') ? val : `https://${val}`);
                                                    const normalized = val.startsWith('http') ? val : `https://${val}`;
                                                    setFormData(f => ({ ...f, links: [...f.links, normalized] }));
                                                    setLinkInput("");
                                                    setLinkError("");
                                                } catch {
                                                    setLinkError("Not a valid URL. Try starting with https://");
                                                }
                                            }
                                        }}
                                        placeholder={formData.links.length === 0 ? "Paste a URL and press Enter..." : "Add another link..."}
                                        className="flex-1 min-w-[180px] bg-transparent outline-none text-sm text-white placeholder-zinc-600"
                                    />
                                </div>
                                {linkError && <p className="text-red-400 text-xs mt-1">{linkError}</p>}
                                <p className="text-zinc-600 text-xs">Press Enter or comma after each URL to add it as a chip.</p>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="deadline">When do you need it? (Deadline)</Label>
                                <Input
                                    id="deadline"
                                    type="date"
                                    min={new Date().toISOString().split("T")[0]}
                                    required
                                    value={formData.deadline}
                                    onChange={handleDateChange}
                                    className="w-full text-white color-scheme-dark"
                                />
                            </div>

                            <div className="pt-4 flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    id="needsReport"
                                    checked={needsReport}
                                    onChange={handleReportChange}
                                    className="w-5 h-5 accent-[#8B5CF6] cursor-pointer rounded border-zinc-700 bg-zinc-900"
                                />
                                <Label htmlFor="needsReport" className="text-base cursor-pointer">
                                    I need a report as well (+₹500)
                                </Label>
                            </div>

                            {/* Voice Note Feature */}
                            <div className="pt-6 border-t-2 border-zinc-800 border-dashed">
                                <Label className="mb-2 block">Lazy to type? Drop a Voice Note 🎙️</Label>
                                <div className="p-4 bg-zinc-950 rounded-xl border-2 border-zinc-800 flex items-center justify-between">

                                    {!audioUrl ? (
                                        <div className="flex items-center gap-4 w-full">
                                            <Button
                                                type="button"
                                                onClick={isRecording ? stopRecording : startRecording}
                                                className={`rounded-full w-12 h-12 flex items-center justify-center border-2 transition-all ${isRecording
                                                        ? 'bg-red-500 border-red-700 hover:bg-red-600 animate-pulse'
                                                        : 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {isRecording ? <Square fill="white" size={18} /> : <Mic size={20} className="text-white" />}
                                            </Button>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-white">
                                                    {isRecording ? "Recording in progress..." : "Tap to start recording"}
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    {isRecording ? "Tap the square to stop." : "Max length: 2 minutes."}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4 w-full">
                                            <Button
                                                type="button"
                                                onClick={togglePlayback}
                                                className="rounded-full w-12 h-12 flex items-center justify-center bg-[#E0FF00] border-2 border-black text-black hover:bg-[#cce600]"
                                            >
                                                {isPlaying ? <Pause fill="black" size={18} /> : <Play fill="black" size={18} className="ml-1" />}
                                            </Button>

                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-white">Voice Note Ready</p>
                                                <p className="text-xs text-zinc-500">Ready to be sent with your project.</p>

                                                <audio
                                                    ref={audioRef}
                                                    src={audioUrl}
                                                    onEnded={() => setIsPlaying(false)}
                                                    className="hidden"
                                                />
                                            </div>

                                            <Button
                                                type="button"
                                                onClick={deleteRecording}
                                                className="rounded-xl px-4 py-2 bg-zinc-800 border-2 border-zinc-600 text-zinc-300 hover:bg-red-950 hover:text-red-400 hover:border-red-900 transition-colors"
                                            >
                                                <Trash2 size={16} className="mr-2" />
                                                Discard
                                            </Button>
                                        </div>
                                    )}

                                </div>
                            </div>

                        </div>
                    </motion.div>
                </div>

                {/* Right Side (Spans 1 Column, Sticky) */}
                <div className="lg:col-span-1 lg:sticky lg:top-8 flex flex-col gap-6">
                    {/* Dynamic Pricing Box */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="p-8 text-black flex flex-col h-full min-h-[400px]"
                        style={{ backgroundColor: "#E0FF00", border: "2px solid black", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", borderRadius: "24px" }}
                    >
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-wider mb-6">Current Quote</h2>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-center font-bold border-b-2 border-black/10 pb-4 text-lg">
                                    <span>Base ({formData.category})</span>
                                    <span>
                                        ₹{Math.round(2000 * (
                                            {
                                                "PPT / Synopsis only": 0.7,
                                                "Documentation only": 0.8,
                                                "UI/UX prototype only": 0.9,
                                                "Mini Project": 1.0,
                                                "Other": 1.0,
                                                "Major Project": 1.3,
                                                "Android / Mobile App": 1.3,
                                                "Data Science / Analytics": 1.4,
                                                "IoT / Embedded": 1.4,
                                                "ML / AI": 1.5
                                            }[formData.category] || 1.0
                                        ))}
                                    </span>
                                </div>

                                {formData.deadline && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="flex justify-between items-center font-bold border-b-2 border-black/10 pb-4 text-lg"
                                        style={{ color: "#8B5CF6" }}
                                    >
                                        <span>
                                            Urgency (
                                            {differenceInDays(new Date(formData.deadline), new Date()) <= 2 ? '≤ 2d' :
                                             differenceInDays(new Date(formData.deadline), new Date()) <= 6 ? '3-6d' :
                                             differenceInDays(new Date(formData.deadline), new Date()) <= 13 ? '1-2w' :
                                             differenceInDays(new Date(formData.deadline), new Date()) <= 20 ? '2-3w' : '>3w'}
                                            )
                                        </span>
                                        <span>
                                            +₹{
                                                calculatePrice(formData.deadline, formData.category, false) - 
                                                Math.round(2000 * (
                                                    {
                                                        "PPT / Synopsis only": 0.7,
                                                        "Documentation only": 0.8,
                                                        "UI/UX prototype only": 0.9,
                                                        "Mini Project": 1.0,
                                                        "Other": 1.0,
                                                        "Major Project": 1.3,
                                                        "Android / Mobile App": 1.3,
                                                        "Data Science / Analytics": 1.4,
                                                        "IoT / Embedded": 1.4,
                                                        "ML / AI": 1.5
                                                    }[formData.category] || 1.0
                                                ))
                                            }
                                        </span>
                                    </motion.div>
                                )}

                                {needsReport && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="flex justify-between items-center font-bold border-b-2 border-black/10 pb-4 text-lg"
                                        style={{ color: "#8B5CF6" }}
                                    >
                                        <span>Detailed Report</span>
                                        <span>+₹500</span>
                                    </motion.div>
                                )}

                                <div className="flex justify-between items-center text-4xl font-black pt-4">
                                    <span>Total</span>
                                    <span>₹{dynamicPrice}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-8">
                            <Button type="submit" size="lg" className="w-full text-xl font-black uppercase py-8 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-none transition-all">
                                Get Quote & Pay
                            </Button>
                        </div>
                    </motion.div>

                    {/* Payment Logic / QR Code Box */}
                    {showQR && !paymentReviewing && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white p-6 md:p-8 text-black flex flex-col items-center text-center"
                            style={{ border: "2px solid black", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", borderRadius: "24px" }}
                        >
                            <h2 className="text-2xl font-black uppercase mb-2">Send Payment</h2>
                            <p className="text-zinc-600 font-medium mb-6">Scan with any UPI app to confirm your slot.</p>

                            <div className="bg-white p-4 border-2 border-dashed border-zinc-300 rounded-xl mb-6 flex justify-center w-full max-w-[220px]">
                                <QRCodeSVG value={upiUrl} size={180} level="H" includeMargin={true} />
                            </div>

                            <div className="w-full space-y-4 mb-6 text-left">
                                <div className="space-y-2">
                                    <Label htmlFor="utr" className="font-bold text-base">UTR Number (12 digits)</Label>
                                    <Input 
                                        id="utr" 
                                        placeholder="e.g. 123456789012" 
                                        className="border-2 border-zinc-300 bg-white text-black focus:border-black font-medium h-12"
                                        value={utrNumber}
                                        onChange={(e) => setUtrNumber(e.target.value)}
                                        maxLength={12}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="screenshot" className="font-bold flex justify-between text-base">
                                        <span>Payment Screenshot</span> 
                                        <span className="text-zinc-500 font-normal">Optional</span>
                                    </Label>
                                    <div className="relative">
                                        <Input 
                                            id="screenshot" 
                                            type="file" 
                                            accept="image/*"
                                            className="border-2 border-zinc-300 bg-zinc-50 focus:border-black file:bg-black file:text-white file:border-0 file:rounded-md file:px-4 file:py-1 file:mr-4 file:cursor-pointer file:hover:bg-zinc-800 cursor-pointer text-sm h-12 pt-2.5"
                                            onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button 
                                type="button"
                                disabled={paymentReviewing}
                                className="w-full bg-[#8B5CF6] hover:bg-[#7c3aed] text-white py-6 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-none transition-all uppercase tracking-wider" 
                                onClick={handleFinalSubmit}
                            >
                                {paymentReviewing ? "Uploading..." : "Submit for Verification"}
                            </Button>
                        </motion.div>
                    )}

                    {/* Payment Reviewing Stage */}
                    {paymentReviewing && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-black text-white p-8 flex flex-col items-center text-center"
                            style={{ border: "2px solid #3f3f46", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", borderRadius: "24px" }}
                        >
                            <div className="w-20 h-20 bg-[#E0FF00] rounded-full flex items-center justify-center mb-6 animate-pulse" style={{ border: "2px solid black" }}>
                                <span className="text-3xl">👀</span>
                            </div>
                            <h2 className="text-2xl font-black uppercase mb-4 text-[#E0FF00]">Payment Under Review</h2>
                            <p className="text-zinc-400 font-medium mb-8">
                                We've received your transaction details. The admin is currently verifying your payment. Once approved, your project will move to the "Cooking" stage!
                            </p>
                            
                            <div className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-xl p-4 text-left">
                                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Stage</div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                                    <span className="font-bold text-white">Reviewing UTR ({utrNumber || "Screenshot attached"})</span>
                                </div>
                            </div>
                            
                            <Button 
                                type="button"
                                disabled={true}
                                className="mt-8 w-full bg-transparent border-2 border-zinc-700 text-zinc-300 cursor-not-allowed"
                            >
                                Uploading files, please wait...
                            </Button>
                        </motion.div>
                    )}
                </div>
            </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
