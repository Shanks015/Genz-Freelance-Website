import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Very simple check: Assuming you have an admin email
    // Let's pass isAdmin down or handle it in specific pages
    // For the free MVP, we'll check against a hardcoded env or allow the page itself to check

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-wasabi selection:text-black">
            <header className="border-b-2 border-neo border-zinc-800 p-3 sm:p-4 shrink-0 flex items-center justify-between">
                <Link href="/" className="text-lg sm:text-xl font-black tracking-tighter hover:opacity-80 transition-opacity shrink-0">
                    BETTERCALL<span className="text-wasabi">SAI</span>
                </Link>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                            <img 
                                src={user.user_metadata.avatar_url || user.user_metadata.picture} 
                                alt="Avatar" 
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-[#E0FF00]" 
                            />
                        ) : (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border-2 border-[#E0FF00] flex items-center justify-center text-[#E0FF00] font-bold text-xs sm:text-sm">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-xs sm:text-sm font-medium text-zinc-400 hidden lg:inline-block">
                            {user.email}
                        </span>
                    </div>
                    <form action="/auth/signout" method="post">
                        <button className="text-xs sm:text-sm font-bold text-white hover:text-wasabi underline decoration-2 underline-offset-4">
                            Sign out
                        </button>
                    </form>
                </div>
            </header>
            <main className="p-4 md:p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
