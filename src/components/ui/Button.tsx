import React from "react";

interface Props {
  children: React.ReactNode;
  href?: string;
  disabled?: boolean;
  className?: string;
  onClick?: (
    e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => void;
  [key: string]: any;
}

export const Button: React.FC<Props> = ({
  children,
  href,
  disabled,
  className = "",
  onClick,
  ...rest
}) => {
  const baseClass = `inline-block px-8 py-4 rounded-2xl font-bold text-center transition-all shadow-premium active:scale-95 ${
    disabled
      ? "bg-gray-100/50 text-gray-400 cursor-not-allowed border border-gray-200"
      : "bg-primary text-white hover:bg-primary/90 hover:shadow-xl"
  } ${className}`;

  if (href && !disabled) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
        onClick={onClick as any}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      disabled={disabled}
      className={baseClass}
      onClick={onClick as any}
      {...rest}
    >
      {children}
    </button>
  );
};
