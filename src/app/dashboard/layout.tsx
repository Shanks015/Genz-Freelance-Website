import { redirect } from "next/navigation";
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
            <header className="border-b-2 border-neo border-zinc-800 p-4 shrink-0 flex items-center justify-between">
                <div className="text-xl font-black tracking-tighter">
                    PROJECT<span className="text-wasabi">DEV</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-zinc-400 hidden sm:inline-block">
                        {user.email}
                    </span>
                    <form action="/auth/signout" method="post">
                        <button className="text-sm font-bold text-white hover:text-wasabi underline decoration-2 underline-offset-4">
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
