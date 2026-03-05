"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type PrintSheetControlsProps = {
  showOverlayToggle: boolean;
};

export default function PrintSheetControls({ showOverlayToggle }: PrintSheetControlsProps) {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) {
      return;
    }
    triggered.current = true;
    window.print();
  }, []);

  const onToggleOverlay = (enabled: boolean) => {
    if (enabled) {
      document.documentElement.setAttribute("data-sheet-overlay", "on");
      return;
    }
    document.documentElement.removeAttribute("data-sheet-overlay");
  };

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-sheet-overlay");
    };
  }, []);

  return (
    <div className="no-print controls">
      <button type="button" onClick={() => window.print()} className="control-button">
        Print Sheet
      </button>
      {showOverlayToggle ? (
        <label className="overlay-toggle">
          <input type="checkbox" onChange={(event) => onToggleOverlay(event.target.checked)} />
          Overlay
        </label>
      ) : null}
      <Link href="/builder" className="control-link">
        Back to Builder
      </Link>
    </div>
  );
}
