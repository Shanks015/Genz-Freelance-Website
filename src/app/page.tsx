"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Handle auth callback if code is present in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      console.log("DEBUG: Auth code detected on home page:", code);
      console.log("DEBUG: Redirecting to /auth/callback via window.location.href...");
      // Using window.location.href ensures we bypass Next.js client-side routing
      // and hit the server-side route handler directly.
      window.location.href = `/auth/callback?code=${code}`;
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === "SIGNED_IN" && session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/admin");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans selection:bg-[#E0FF00] selection:text-black">
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="flex justify-between items-center mb-16"
      >
        <div className="text-2xl font-black tracking-tighter">
          PROJECT<span style={{ color: "#E0FF00" }}>DEV</span>
        </div>
        <div className="flex gap-4 items-center">
          {!loading && user ? (
            <>
              <div className="hidden sm:flex items-center gap-3 mr-2">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-[#E0FF00]" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-[#E0FF00] flex items-center justify-center text-[#E0FF00] font-bold">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-sm">
                  <p className="font-bold text-white">{user.user_metadata?.full_name || user.email?.split('@')[0]}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="hidden sm:inline-flex border-zinc-700 text-zinc-300 bg-black hover:bg-zinc-900 hover:text-white border-2"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.refresh();
                }}
              >
                Logout
              </Button>
              <Button
                className="bg-[#E0FF00] border-[#E0FF00] text-black hover:bg-[#c9e500]"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </Button>
              {user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                <Button
                  className="bg-[#8B5CF6] border-[#8B5CF6] text-white hover:bg-[#7c3aed]"
                  onClick={() => router.push("/admin")}
                >
                  Admin Center
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="hidden sm:inline-flex border-white text-white bg-black hover:bg-zinc-900 border-2"
                onClick={() => router.push("/login")}
              >
                Client Login
              </Button>
              <Button
                className="bg-[#E0FF00] border-[#E0FF00] text-black hover:bg-[#c9e500]"
                onClick={() => router.push("/login")}
              >
                Start a Project
              </Button>
            </>
          )}
        </div>
      </motion.header>

      {/* Hero Section - Bento Grid */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[240px]"
      >
        {/* Main Hero Card */}
        <motion.div
          variants={itemVariants}
          className="col-span-1 md:col-span-2 row-span-2 border-2 border-black p-8 md:p-12 flex flex-col justify-between overflow-hidden relative"
          style={{
            backgroundColor: "#8B5CF6",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
            borderRadius: "24px",
          }}
        >
          <div className="relative z-10 max-w-lg">
            <h1 className="text-5xl md:text-7xl font-black leading-[0.9] text-black uppercase tracking-tighter mb-6">
              Ship software faster.
            </h1>
            <p className="text-xl md:text-2xl font-medium text-black/80 max-w-md">
              Submit your idea. Get a quote. Watch me cook.
            </p>
          </div>
          <div className="relative z-10 mt-8">
            <Button
              size="lg"
              className="bg-black text-white border-black hover:bg-zinc-800 text-lg"
              onClick={() => router.push("/login")}
            >
              Vibe Check Your Idea ⚡
            </Button>
          </div>
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-black rounded-full mix-blend-overlay opacity-20 blur-3xl" />
        </motion.div>

        {/* Dynamic Pricing Card */}
        <motion.div
          variants={itemVariants}
          className="bg-zinc-900 border-2 border-zinc-700 p-8 flex flex-col justify-between group hover:border-[#E0FF00] transition-colors cursor-pointer"
          style={{ boxShadow: "4px 4px 0px 0px rgba(255,255,255,0.1)", borderRadius: "24px" }}
          onClick={() => router.push("/login")}
        >
          <div>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-6 border-2 border-black rotate-[-10deg] group-hover:rotate-12 transition-transform"
              style={{ backgroundColor: "#E0FF00", boxShadow: "2px 2px 0px 0px #E0FF00" }}
            >
              <span className="text-black font-black text-xl">₹</span>
            </div>
            <h3 className="text-2xl font-bold mb-2">Dynamic Pricing</h3>
            <p className="text-zinc-400 font-medium">
              Clear rates starting at ₹2K. Rush orders scale automatically. No surprises.
            </p>
          </div>
        </motion.div>

        {/* Status Tracking Card */}
        <motion.div
          variants={itemVariants}
          className="border-2 border-black p-8 flex flex-col justify-between group cursor-pointer"
          style={{
            backgroundColor: "#E0FF00",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
            borderRadius: "24px",
          }}
          onClick={() => router.push(user ? "/dashboard" : "/login")}
        >
          <div>
            <div className="flex gap-2 mb-6">
              <span className="px-3 py-1 bg-black text-white text-xs font-black uppercase tracking-wider rounded-full border-2 border-black">
                Pending
              </span>
              <span
                className="px-3 py-1 bg-white text-black text-xs font-black uppercase tracking-wider rounded-full border-2 border-black"
                style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
              >
                Cooking
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2 text-black">Track the Vibe</h3>
            <p className="text-black/70 font-bold">
              Watch your project move from pending to deployed in real-time.
            </p>
          </div>
        </motion.div>

        {/* Chat/Media Card */}
        <motion.div
          variants={itemVariants}
          className="col-span-1 md:col-span-3 bg-zinc-900 border-2 border-zinc-700 p-8 flex flex-col md:flex-row items-center justify-between gap-8"
          style={{ boxShadow: "4px 4px 0px 0px rgba(255,255,255,0.1)", borderRadius: "24px" }}
        >
          <div className="max-w-xl">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-4 text-white">
              Share context effortlessly
            </h2>
            <p className="text-lg text-zinc-400 font-medium mb-6">
              Text is boring. Drop voice notes, paste Figma links, or record quick Loom-style video briefs directly in the chat.
            </p>
            <Button
              variant="outline"
              className="border-zinc-700 text-white hover:bg-zinc-800"
              onClick={() => router.push(user ? "/dashboard" : "/login")}
            >
              Explore Dashboard
            </Button>
          </div>
          <div
            className="w-full md:w-1/3 h-40 bg-black border-2 border-zinc-800 flex items-center justify-center relative overflow-hidden"
            style={{ borderRadius: "24px" }}
          >
            <div className="flex items-center gap-1 opacity-60">
              {[1, 2, 3, 4, 3, 5, 2, 6, 2, 3, 1, 4, 2].map((h, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [h * 4, h * 10, h * 4] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                  className="w-2 rounded-full"
                  style={{ backgroundColor: "#E0FF00", height: `${h * 4}px` }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.main>

      <footer className="max-w-6xl mx-auto mt-10 text-center text-zinc-600 text-sm font-medium">
        Built for the ones who ship fast.{" "}
        <button
          onClick={() => router.push("/admin")}
          className="text-zinc-700 hover:text-zinc-400 transition-colors underline"
        >
          Admin?
        </button>
      </footer>
    </div>
  );
}
