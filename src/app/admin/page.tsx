"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import {
    MessageSquare, ChevronDown, ChevronUp, Search, Clock,
    CheckCircle, Loader, AlertTriangle, IndianRupee, Users, Zap, Filter, Bell
} from "lucide-react";
import { toast } from "sonner";

type ProjectStatus = "Payment Review" | "Pending" | "Accepted" | "Rejected" | "Cooking" | "Review" | "In Progress" | "Done";

interface Notification {
    id: string;
    message: string;
    description: string;
    time: string;
    projectId?: string;
    read: boolean;
}

interface Project {
    id: string;
    name: string;
    title: string;
    category: string;
    description: string;
    deadline: string;
    status: ProjectStatus;
    total_price: number;
    amount_paid?: number;
    admin_notes?: string;
    needs_report: boolean;
    links: string;
    utr_number: string;
    client_email?: string;
    created_at: string;
}

const STATUS_CONFIG: Record<ProjectStatus, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
    "Payment Review": { bg: "#3b82f6", color: "#fff",   icon: <IndianRupee size={12} />, label: "Review ₹" },
    "Pending":        { bg: "#3f3f46", color: "#fff",   icon: <Clock size={12} />,        label: "Pending" },
    "Accepted":       { bg: "#10B981", color: "#fff",   icon: <CheckCircle size={12} />,  label: "Accept" },
    "Rejected":       { bg: "#EF4444", color: "#fff",   icon: <AlertTriangle size={12} />,label: "Reject" },
    "Cooking":        { bg: "#8B5CF6", color: "#fff",   icon: <Loader size={12} />,       label: "Cooking" },
    "In Progress":    { bg: "#f97316", color: "#fff",   icon: <Zap size={12} />,          label: "In Progress" },
    "Review":         { bg: "#facc15", color: "#000",   icon: <AlertTriangle size={12} />,label: "Review" },
    "Done":           { bg: "#E0FF00", color: "#000",   icon: <CheckCircle size={12} />,  label: "Done ✓" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as ProjectStatus[];

// ── CHANGE THIS to your admin Google account email ──────────────────────
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function AdminDashboard() {
    const router = useRouter();
    const supabase = createClient();

    const [projects, setProjects] = useState<Project[]>([]);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<ProjectStatus | "All">("All");

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
        const init = async () => {
            // ── Admin Guard ──────────────────────────────────────────────
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
                router.replace("/");
                return;
            }
            setUser(currentUser);
            setIsAdmin(true);
            // ─────────────────────────────────────────────────────────────

            // Fetch projects. Note: you cannot join auth.users directly.
            // But we will fetch the project data and show what we can
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .order("deadline", { ascending: true });

            if (data) {
                // If you want contact details, you might need an RPC call or edge function to get emails.
                // For now, if the user explicitly provided an email inside another flow, we would use it.
                // Let's set the projects.
                setProjects(data as Project[]);
            }
            else if (error) console.error("Failed to fetch projects:", error);
            setIsLoading(false);
        };
        init();

        const channel = supabase.channel('admin-notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, (payload) => {
                const newProject = payload.new as Project;
                toast.success("🚀 New Project Submitted!", {
                    description: `Client: ${newProject.name} | Category: ${newProject.category}`
                });
                setProjects(prev => [newProject, ...prev]);
                setNotifications(prev => [{
                    id: Date.now().toString(),
                    message: "New Project Submitted!",
                    description: `Client: ${newProject.name}`,
                    time: new Date().toISOString(),
                    read: false
                }, ...prev]);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMsg = payload.new;
                if (newMsg.sender_role !== 'admin') {
                    toast.info("💬 New Client Message", {
                        description: newMsg.content ? "They sent a text." : "They sent an attachment or voice note.",
                        action: {
                            label: "View Chat",
                            onClick: () => router.push(`/projects/${newMsg.project_id}`)
                        }
                    });
                    setNotifications(prev => [{
                        id: Date.now().toString() + Math.random(),
                        message: "New Client Message",
                        description: newMsg.content ? "They sent a text." : "Attachment or voice note.",
                        time: new Date().toISOString(),
                        projectId: newMsg.project_id,
                        read: false
                    }, ...prev]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (!isAdmin) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest">Verifying Clearance...</div>;
    }

    const updateStatus = async (id: string, newStatus: ProjectStatus) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        const { error } = await supabase.from("projects").update({ status: newStatus }).eq("id", id);
        if (error) {
            console.error("Failed to update status in DB:", error);
            alert("Database error updating status: " + error.message);
        }
    };

    const updateAmountPaid = async (id: string, newAmount: number) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, amount_paid: newAmount } : p));
        await supabase.from("projects").update({ amount_paid: newAmount }).eq("id", id);
    };

    const updateAdminNotes = async (id: string, newNotes: string) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, admin_notes: newNotes } : p));
        const { error } = await supabase.from("projects").update({ admin_notes: newNotes }).eq("id", id);
        if (error) {
            console.error("Failed to save admin notes:", error);
            alert("Database error saving admin notes: " + error.message);
        }
    };

    // ── Stats ──────────────────────────────────────────────────────────────
    const totalRevenue = projects.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const activeCount = projects.filter(p => !["Done", "Pending"].includes(p.status)).length;
    const urgentCount = projects.filter(p => {
        const d = differenceInDays(new Date(p.deadline), new Date());
        return d <= 3 && p.status !== "Done";
    }).length;

    // ── Filtered list ──────────────────────────────────────────────────────
    const filtered = projects.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
                            p.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === "All" || p.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div className="min-h-screen bg-black text-white font-sans p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6" style={{ borderBottom: "2px solid #27272a" }}>
                    <div className="flex items-center gap-6">
                        {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                            <img 
                                src={user.user_metadata.avatar_url || user.user_metadata.picture} 
                                alt="Admin Avatar" 
                                className="w-16 h-16 rounded-2xl border-2 border-[#8B5CF6] shadow-[4px_4px_0px_0px_#8B5CF6]" 
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border-2 border-[#8B5CF6] shadow-[4px_4px_0px_0px_#8B5CF6] flex items-center justify-center text-[#8B5CF6] font-black text-2xl">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <button 
                                    onClick={async () => {
                                        await supabase.auth.signOut();
                                        router.replace("/");
                                    }} 
                                    className="text-red-500/70 text-xs font-bold hover:text-red-500 tracking-widest uppercase"
                                >
                                    Sign Out
                                </button>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                                Admin <span style={{ color: "#8B5CF6" }}>Command Center</span>
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative" ref={notificationRef}>
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-3 bg-zinc-900 border-2 border-zinc-800 rounded-full hover:bg-zinc-800 transition-colors relative"
                            >
                                <Bell size={20} className="text-zinc-400" />
                                {notifications.filter(n => !n.read).length > 0 && (
                                    <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-black"></span>
                                )}
                            </button>
                            {/* Notification Dropdown */}
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
                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-black" style={{ background: "#18181b", border: "2px solid #3f3f46", borderRadius: "14px" }}>
                            <Zap size={14} style={{ color: "#E0FF00" }} />
                            <span style={{ color: "#E0FF00" }}>Queue sorted by urgency</span>
                        </div>
                    </div>
                </div>

                {/* ── Stats Bar ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Projects", value: projects.length, icon: <Users size={20} />, color: "#8B5CF6" },
                        { label: "Active Now",     value: activeCount,      icon: <Loader size={20} />, color: "#f97316" },
                        { label: "Urgent",         value: urgentCount,      icon: <AlertTriangle size={20} />, color: "#ef4444" },
                        { label: "Revenue (Done)", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: <IndianRupee size={20} />, color: "#E0FF00" },
                    ].map((stat) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-zinc-900 p-5 flex flex-col gap-2"
                            style={{ border: "2px solid #3f3f46", borderRadius: "20px", boxShadow: "3px 3px 0px 0px rgba(255,255,255,0.04)" }}
                        >
                            <div style={{ color: stat.color }}>{stat.icon}</div>
                            <div className="text-2xl md:text-3xl font-black text-white">{stat.value}</div>
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>

                {/* ── Search + Filter ── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by project title or client name..."
                            className="w-full bg-zinc-900 text-white pl-10 pr-4 py-3 outline-none font-medium placeholder-zinc-600 transition-colors focus:border-[#8B5CF6]"
                            style={{ border: "2px solid #3f3f46", borderRadius: "14px" }}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                        <Filter size={14} className="text-zinc-500 shrink-0" />
                        {(["All", ...ALL_STATUSES] as (ProjectStatus | "All")[]).map(s => {
                            const isActive = filterStatus === s;
                            const cfg = s !== "All" ? STATUS_CONFIG[s] : null;
                            return (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className="px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all"
                                    style={{
                                        borderRadius: "10px",
                                        border: "2px solid",
                                        borderColor: isActive ? (cfg ? cfg.bg : "#E0FF00") : "#3f3f46",
                                        background: isActive ? (cfg ? cfg.bg : "#E0FF00") : "transparent",
                                        color: isActive ? (cfg ? cfg.color : "#000") : "#71717a",
                                    }}
                                >
                                    {s === "All" ? "All" : STATUS_CONFIG[s].label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Project List ── */}
                {isLoading ? (
                    <div className="text-center text-zinc-500 font-bold p-16">Fetching secure datalink...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center text-zinc-500 font-bold p-16">No projects match your filters.</div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map((project, idx) => {
                            const daysLeft = differenceInDays(new Date(project.deadline), new Date());
                            const isUrgent = daysLeft <= 3 && project.status !== "Done";
                            const isExpanded = expandedId === project.id;
                            const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG["Pending"];

                            return (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                    className="bg-zinc-900 overflow-hidden"
                                    style={{
                                        border: `2px solid ${isUrgent ? "#ef4444" : "#3f3f46"}`,
                                        boxShadow: isUrgent ? "4px 4px 0px 0px #ef4444" : "4px 4px 0px 0px rgba(255,255,255,0.04)",
                                        borderRadius: "20px",
                                    }}
                                >
                                    {/* ── Row Header ── */}
                                    <div className="p-5 md:p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                        {/* Left: title + meta */}
                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex items-center gap-3 flex-wrap mb-1">
                                                <h3 className="text-lg sm:text-xl font-black uppercase truncate">{project.title}</h3>
                                                {isUrgent && (
                                                    <span className="px-2 py-0.5 text-xs font-black uppercase tracking-wider flex-shrink-0" style={{ backgroundColor: "#ef4444", color: "#fff", border: "2px solid black", borderRadius: "8px" }}>
                                                        🔥 Rush
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-zinc-400 flex items-center gap-3 flex-wrap">
                                                <span>👤 <span className="text-white font-bold">{project.name}</span></span>
                                                <span className="text-zinc-600">•</span>
                                                <span className="text-xs font-bold uppercase text-zinc-500">{project.category}</span>
                                                <span className="text-zinc-600">•</span>
                                                <span className="font-black" style={{ color: "#E0FF00" }}>₹{project.total_price?.toLocaleString("en-IN")}</span>
                                                {project.needs_report && <span className="text-xs text-purple-400 font-bold">+ Report</span>}
                                            </div>
                                        </div>

                                        {/* Right: deadline + status + actions */}
                                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                                            {/* Deadline */}
                                            <div className="text-center">
                                                <div className="text-xs text-zinc-500 uppercase font-black tracking-widest">Deadline</div>
                                                <div className="font-bold text-lg" style={{ color: isUrgent ? "#ef4444" : "#fff" }}>
                                                    {format(new Date(project.deadline), "MMM dd")}
                                                    <span className="text-xs text-zinc-500 ml-1">({daysLeft}d)</span>
                                                </div>
                                            </div>

                                            {/* Current status badge */}
                                            <div
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wide"
                                                style={{ background: cfg.bg, color: cfg.color, border: "2px solid black", borderRadius: "10px", boxShadow: "2px 2px 0px 0px black" }}
                                            >
                                                {cfg.icon} {project.status}
                                            </div>

                                            {/* Open Chat */}
                                            <button
                                                onClick={() => router.push(`/projects/${project.id}`)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-black uppercase tracking-wider text-black hover:opacity-90 transition-opacity"
                                                style={{ backgroundColor: "#E0FF00", border: "2px solid black", boxShadow: "2px 2px 0px 0px black", borderRadius: "12px" }}
                                            >
                                                <MessageSquare size={14} /> Chat
                                            </button>

                                            {/* Expand toggle */}
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : project.id)}
                                                className="p-2 text-zinc-500 hover:text-white transition-colors"
                                                style={{ border: "2px solid #3f3f46", borderRadius: "10px" }}
                                            >
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Expanded Details ── */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-6 pb-6 space-y-6" style={{ borderTop: "2px solid #27272a" }}>
                                                    <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Description */}
                                                        {project.description && (
                                                            <div>
                                                                <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Description</div>
                                                                <p className="text-sm text-zinc-300 leading-relaxed bg-black p-3 rounded-xl border border-zinc-800">{project.description}</p>
                                                            </div>
                                                        )}

                                                        {/* Links + UTR */}
                                                        <div className="space-y-4">
                                                            {project.links && (
                                                                <div>
                                                                    <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Reference Links</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {project.links.split(",").filter(Boolean).map((link, i) => (
                                                                            <a
                                                                                key={i}
                                                                                href={link.trim()}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-xs px-3 py-1 rounded-full font-bold hover:opacity-80 transition-opacity truncate max-w-[200px]"
                                                                                style={{ background: "#1e1e2e", border: "2px solid #8B5CF6", color: "#c4b5fd" }}
                                                                            >
                                                                                {link.trim().replace(/^https?:\/\//, "")}
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {project.utr_number && (
                                                                <div>
                                                                    <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">UTR Number</div>
                                                                    <div
                                                                        className="text-sm font-mono font-bold px-3 py-2 tracking-widest"
                                                                        style={{ background: "#000", border: "2px solid #22C55E", borderRadius: "10px", color: "#4ade80" }}
                                                                    >
                                                                        {project.utr_number}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div>
                                                                <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">Submitted</div>
                                                                <div className="text-sm text-zinc-400 font-medium">
                                                                    {format(new Date(project.created_at), "dd MMM yyyy, hh:mm a")}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* ── Status Switcher ── */}
                                                    <div>
                                                        <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Update Status</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {ALL_STATUSES.map((status) => {
                                                                const isActive = project.status === status;
                                                                const s = STATUS_CONFIG[status];
                                                                return (
                                                                    <button
                                                                        key={status}
                                                                        onClick={() => updateStatus(project.id, status)}
                                                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider transition-all"
                                                                        style={{
                                                                            borderRadius: "10px",
                                                                            border: isActive ? "2px solid black" : "2px solid #3f3f46",
                                                                            backgroundColor: isActive ? s.bg : "#18181b",
                                                                            color: isActive ? s.color : "#71717a",
                                                                            boxShadow: isActive ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                                                                        }}
                                                                    >
                                                                        {s.icon} {s.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* ── Financial Tracking ── */}
                                                    <div>
                                                        <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Financial Tracking</div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                                            <div className="bg-black p-4 rounded-xl border-2 border-zinc-800">
                                                                <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Total Quote</div>
                                                                <div className="text-xl font-black text-[#E0FF00]">₹{project.total_price?.toLocaleString("en-IN")}</div>
                                                            </div>
                                                            <div className="bg-black p-4 rounded-xl border-2 border-zinc-800">
                                                                <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Received Amount</div>
                                                                <div className="text-xl font-black text-green-400">₹{(project.amount_paid || 0).toLocaleString("en-IN")}</div>
                                                            </div>
                                                            <div className="bg-black p-4 rounded-xl border-2 border-zinc-800">
                                                                <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Pending Balance</div>
                                                                <div className="text-xl font-black text-red-400">₹{Math.max(0, project.total_price - (project.amount_paid || 0)).toLocaleString("en-IN")}</div>
                                                            </div>
                                                        </div>

                                                        {/* Update Payment Inline Form */}
                                                        <form 
                                                            onSubmit={(e) => {
                                                                e.preventDefault();
                                                                const formData = new FormData(e.currentTarget);
                                                                const amount = Number(formData.get("amount_paid"));
                                                                if (!isNaN(amount)) updateAmountPaid(project.id, amount);
                                                            }}
                                                            className="flex gap-2 max-w-sm"
                                                        >
                                                            <div className="relative flex-1">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <span className="text-zinc-500 font-bold">₹</span>
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    name="amount_paid"
                                                                    defaultValue={project.amount_paid || 0}
                                                                    className="w-full bg-black text-white pl-8 pr-4 py-2 outline-none font-bold transition-colors focus:border-[#8B5CF6]"
                                                                    style={{ border: "2px solid #3f3f46", borderRadius: "10px" }}
                                                                    placeholder="Enter received amount"
                                                                />
                                                            </div>
                                                            <button 
                                                                type="submit"
                                                                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition-colors hover:opacity-90 whitespace-nowrap"
                                                                style={{ backgroundColor: "#E0FF00", border: "2px solid black", borderRadius: "10px", boxShadow: "2px 2px 0px 0px black" }}
                                                            >
                                                                Update ₹
                                                            </button>
                                                        </form>
                                                    </div>

                                                    {/* ── Admin Private Notes ── */}
                                                    <div className="mt-6">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="text-xs font-black text-rose-500 uppercase tracking-widest">Secret Admin Notes</div>
                                                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest bg-zinc-900 px-2 py-0.5 rounded-full">Only visible to you</span>
                                                        </div>
                                                        <textarea
                                                            defaultValue={project.admin_notes || ""}
                                                            onBlur={(e) => updateAdminNotes(project.id, e.target.value)}
                                                            placeholder="Jot down server passwords, ideas, or reminders about this client... (Auto-saves when you click away)"
                                                            className="w-full bg-[#18181b] text-white p-4 outline-none font-medium transition-colors focus:border-rose-500 min-h-[120px]"
                                                            style={{ border: "2px solid #3f3f46", borderRadius: "10px" }}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
