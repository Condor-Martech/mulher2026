import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
}

export const GlassCard: React.FC<Props> = ({
  children,
  className = "",
  variant = "light",
}) => {
  const baseClass = variant === "light" ? "glass" : "glass-dark";

  return (
    <div
      className={`${baseClass} rounded-[2.5rem] shadow-premium border border-primary/20 overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
};
