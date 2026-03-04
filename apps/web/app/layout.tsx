import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Dark Sun Builder",
  description: "Character Builder for Dark Sun"
};

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
