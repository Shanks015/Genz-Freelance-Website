# Project-as-a-Service Platform

A comprehensive, full-stack "Project-as-a-Service" platform designed for freelancers and digital agencies to manage client requests, collaborate in real-time, and process project updates seamlessly. Built with a modern, GenZ-optimized "Neubrutalist Bento Grid" UI aesthetic.

## 🚀 Features

### Core Capabilities
* **Dual Dashboards:** Specially tailored views for both the Administrator (Freelancer) and the Clients.
* **Neubrutalist UI:** A visually striking, modern interface featuring glassmorphism, dynamic animations, and a sleek dark mode.
* **Real-time Collaboration:** Instant messaging and chat functionality between the admin and clients for each project, powered by Supabase Realtime.
* **Live Notifications:** Real-time push notifications for new projects, status changes, and incoming messages using `sonner` and Supabase.
* **Dynamic Pricing Engine:** Automated project cost calculation based on selected deadlines and requirements.
* **UPI Payment Integration:** Seamless generation of UPI QR codes for quick and easy client payments.
* **Secret Admin Notes:** Private, automatically saving notes for the admin on each project dashboard.

## 🛠️ Tech Stack

This project is built using modern web development technologies to ensure performance, scalability, and an excellent developer experience.

* **Framework:** [Next.js](https://nextjs.org/) (React framework for server-rendered applications)
* **Language:** TypeScript
* **Database & Authentication:** [Supabase](https://supabase.com/) (PostgreSQL, GoTrue Auth, Realtime APIs)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Animations:** [Framer Motion](https://www.framer.com/motion/)
* **Icons:** [Lucide React](https://lucide.dev/)
* **Notifications:** [Sonner](https://sonner.emilkowal.ski/)

## 📂 Project Structure

```text
src/
├── app/
│   ├── admin/              # Admin Dashboard interface
│   ├── auth/               # Authentication routes and callbacks
│   ├── dashboard/          # Client Dashboard interface
│   ├── projects/[id]/      # Individual project workspace & chat
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout and global providers
│   └── globals.css         # Global Tailwind styles
├── components/             # Reusable UI components
├── utils/
│   └── supabase/           # Supabase client, server, and middleware wrappers
```

## ⚙️ How it Works

1. **Authentication:** Users authenticate securely via Google OAuth or Email credentials managed by Supabase.
2. **Client Flow:** A client logs in, accesses their dashboard, and submits a new project request. They can select their required features and deadline, and the system dynamically quotes a price.
3. **Admin Flow:** The platform owner (Admin) receives a real-time notification of the new project. They can review it on the Admin Dashboard, toggle its status (e.g., "Cooking", "Testing", "Completed"), and leave private notes.
4. **Collaboration:** Both parties can enter the specific project workspace to chat in real-time. Status updates and new messages trigger instant notifications across the platform.

## 💻 Local Setup & Installation

Follow these steps to get the project running on your local machine.

### Prerequisites
* Node.js (v18 or higher recommended)
* npm, yarn, or pnpm
* A [Supabase](https://supabase.com/) account and project.

### 1. Clone the repository
```bash
git clone https://github.com/Shanks015/Genz-Freelance-Website.git
cd Genz-Freelance-Website
```

### 2. Install dependencies
```bash
npm install
# or
yarn install
```

### 3. Setup Environment Variables
Create a `.env.local` file in the root directory of the project. You will need to extract your API keys from your Supabase project dashboard.

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Platform Configuration
NEXT_PUBLIC_ADMIN_EMAIL=your_admin_google_email@gmail.com
NEXT_PUBLIC_UPI_ID=your_upi_id@bank
```
*(Note: Replace the placeholder values with your actual credentials. This file is ignored by Git to keep your secrets safe.)*

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🚀 Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

1. Push your code to a GitHub repository.
2. Import the repository into Vercel.
3. Add your Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `NEXT_PUBLIC_UPI_ID`) in the Vercel project settings.
4. Deploy!

## 🔐 Security Notes
All sensitive credentials, including Admin routing checks and payment IDs, have been abstracted to environment variables. Ensure that you never commit your `.env.local` file to version control.
