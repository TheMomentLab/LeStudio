import React from "react";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useTheme } from "../../theme-context";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      gap={8}
      toastOptions={{
        style: {
          boxShadow:
            "0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid var(--border)",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
