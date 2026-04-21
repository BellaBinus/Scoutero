import type { ReactNode } from "react";

interface PageBannerProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function PageBanner({ title, subtitle, action }: PageBannerProps) {
  return (
    <div
      style={{
        background: "#4d7435",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <h1
          className="text-3xl sm:text-4xl font-display font-bold"
          style={{ color: "#ffffff", marginBottom: subtitle ? 6 : 0 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
