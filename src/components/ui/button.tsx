"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {

        // Neubrutalist spring animation
        const tapAnimation = { scale: 0.95, y: 4, x: 4 };

        return (
            <motion.button
                ref={ref}
                whileHover={{ y: -2, x: -2 }}
                whileTap={tapAnimation}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-neo text-sm font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    "border-neo shadow-neo hover:shadow-neo-hover",
                    {
                        "bg-wasabi text-black border-black hover:bg-[#c4e000]": variant === "default",
                        "bg-transparent text-foreground border-foreground hover:bg-zinc-800": variant === "outline",
                        "hover:bg-zinc-800 hover:text-foreground shadow-none border-transparent max-w-fit": variant === "ghost",
                        "h-12 px-6 py-2": size === "default",
                        "h-9 rounded-md px-3": size === "sm",
                        "h-14 rounded-neo px-8 text-base": size === "lg",
                        "h-12 w-12": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button };
