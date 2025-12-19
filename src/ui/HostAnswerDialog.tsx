import { useEffect, useState } from "react";
import { isHostDialogWindow } from "./hostDialogUtils";

type HostDialogPayload = {
  name: string | null;
  previousName?: string | null;
  category?: string | null;
};

declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        send: (channel: string, data?: unknown) => void;
        on: (channel: string, func: (...args: unknown[]) => void) => void;
        off: (channel: string, func: (...args: unknown[]) => void) => void;
      };
    };
  }
}

export function HostAnswerDialog() {
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [previousName, setPreviousName] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const isSeparateWindow = isHostDialogWindow();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<HostDialogPayload>).detail;
      setCurrentName(detail?.name ?? null);
      setPreviousName(detail?.previousName ?? null);
      setCategory(detail?.category ?? null);
    };
    window.addEventListener("hostAnswerDialogUpdate", handler);
    return () => window.removeEventListener("hostAnswerDialogUpdate", handler);
  }, []);

  useEffect(() => {
    if (!isSeparateWindow) return;
    if (typeof window === "undefined") return;
    const listener = (data: HostDialogPayload) => {
      setCurrentName(data?.name ?? null);
      setPreviousName(data?.previousName ?? null);
      setCategory(data?.category ?? null);
    };
    window.electron?.ipcRenderer.on("hostDialog:update", listener as (...args: unknown[]) => void);
    return () => {
      window.electron?.ipcRenderer.off("hostDialog:update", listener as (...args: unknown[]) => void);
    };
  }, [isSeparateWindow]);

  if (!isSeparateWindow) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "stretch",
        width: "100vw",
        height: "100vh",
        background: "#0b0b0f",
        color: "#e8edf7",
        padding: 0,
        margin: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          borderBottom: "1px solid #243049",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 800, letterSpacing: "0.3px", fontSize: "16px" }}>Host Answers</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px", overflowY: "auto", gap: "12px" }}>
        <div style={{ fontSize: "13px", color: "#b9c8e7" }}>
          Category: <span style={{ color: "#ffc542", fontWeight: 700 }}>{category ?? "Waiting"}</span>
        </div>

        <div style={{
          padding: "12px",
          background: "#111726",
          border: "1px solid #1f2a40",
          borderRadius: "10px",
          lineHeight: 1.4,
          flex: 1,
        }}>
          <div style={{ fontSize: "12px", color: "#9eb7ff", marginBottom: "6px" }}>Current picture</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>
            {currentName ?? "No picture showing yet"}
          </div>
          {previousName ? (
            <div style={{ fontSize: "12px", color: "#9eb7ff" }}>
              Previous: <span style={{ color: "#d7def2" }}>{previousName}</span>
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: "12px", color: "#8e9bb8", lineHeight: 1.4 }}>
          This window shows only to the host. Reference answers here during battles.
        </div>
      </div>
    </div>
  );
}

export function HostAnswerDialogToggle() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "h" || event.key === "H") && event.shiftKey) {
        event.preventDefault();
        console.log("Shift+H pressed, window.electron:", window.electron);
        if (typeof window !== "undefined" && window.electron?.ipcRenderer) {
          console.log("Sending hostDialog:open message");
          window.electron.ipcRenderer.send("hostDialog:open");
        } else {
          console.warn("window.electron or ipcRenderer not available");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
