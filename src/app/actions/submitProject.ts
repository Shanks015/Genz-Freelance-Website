"use server";

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function submitProjectAction(formData: FormData) {
    try {
        const supabase = await createClient();
        
// 1. Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        const client_email = user?.email || "";
        if (authError || !user) {
            return { success: false, error: "You must be logged in to submit a project." };
        }

        // 2. Extract basic form fields
        const name = formData.get("name") as string;
        const title = formData.get("title") as string;
        const category = formData.get("category") as string;
        const description = formData.get("description") as string;
        const links = formData.get("links") as string;
        const deadline = formData.get("deadline") as string;
        const needsReport = formData.get("needsReport") === "true";
        const totalPrice = parseInt(formData.get("totalPrice") as string, 10);
        const utrNumber = formData.get("utrNumber") as string;

        if (!name || !title || !category || !description || !deadline || !totalPrice) {
            return { success: false, error: "Missing required fields." };
        }

        // 3. Create the DB Record First so we have an ID for storage paths
        const { data: projectData, error: dbError } = await supabase
            .from('projects')
            .insert({
                client_id: user.id,
                name,
                title,
                category,
                description,
                links,
                deadline,
                needs_report: needsReport,
                total_price: totalPrice,
                utr_number: utrNumber,
                client_email: client_email,
                status: 'Payment Review', // Start in Payment Review since they just submitted UTR
            })
            .select()
            .single();

        if (dbError || !projectData) {
            console.error("DB Insert Error:", dbError);
            return { success: false, error: "Failed to create project record in database." };
        }

        const projectId = projectData.id;

        // 4. Handle File Uploads (Voice Note, Screenshot, Attachments)
        const storagePromises = [];
        
        // Voice Note
        const voiceNote = formData.get("voiceNote") as File | null;
        if (voiceNote && voiceNote.size > 0) {
            const filePath = `${projectId}/audio/${Date.now()}_voice_note.webm`;
            storagePromises.push(
                supabase.storage.from('project-files').upload(filePath, voiceNote)
            );
        }

        // Screenshot
        const screenshot = formData.get("screenshot") as File | null;
        if (screenshot && screenshot.size > 0) {
            const ext = screenshot.name.split('.').pop() || 'png';
            const filePath = `${projectId}/screenshots/${Date.now()}_payment.${ext}`;
            storagePromises.push(
                supabase.storage.from('project-files').upload(filePath, screenshot)
            );
        }

        // Additional Attachments (Looping through multiple files)
        const allKeys = Array.from(formData.keys());
        const attachmentKeys = allKeys.filter(k => k.startsWith('attachment_'));
        
        for (const key of attachmentKeys) {
            const file = formData.get(key) as File;
            if (file && file.size > 0) {
                // Sanitize filename to be safe for storage
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const filePath = `${projectId}/attachments/${Date.now()}_${safeName}`;
                storagePromises.push(
                    supabase.storage.from('project-files').upload(filePath, file)
                );
            }
        }

        // Wait for all uploads to finish
        if (storagePromises.length > 0) {
            const uploadResults = await Promise.allSettled(storagePromises);
            // We can optionally log failed uploads here, but won't block the project creation
            uploadResults.forEach((res, idx) => {
                if(res.status === 'rejected') {
                    console.error(`Upload ${idx} failed:`, res.reason);
                }
            });
        }

        return { success: true, projectId: projectId };

    } catch (error: any) {
        console.error("Submission Action Error:", error);
        return { success: false, error: error.message || "An unexpected error occurred during submission." };
    }
}
