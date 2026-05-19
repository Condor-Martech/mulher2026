import React from "react";

interface Props {
  label: string;
  className?: string;
}

export const Badge: React.FC<Props> = ({ label, className = "" }) => {
  return (
    <span
      className={`badge-label px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${className}`}
    >
      {label}
    </span>
  );
};
