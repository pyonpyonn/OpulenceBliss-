"use client";

import type { ReactNode } from "react";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style jsx global>{`
        .areas-card {
          grid-template-columns: 1fr !important;
        }

        .areas-visual {
          display: none !important;
        }
      `}</style>
    </>
  );
}
