import "./App.css";
import { useEffect, useState } from "react";
import { FloorGameContainer } from "./ui/FloorGameContainer";
import { HostAnswerDialogToggle, HostAnswerDialog } from "./ui/HostAnswerDialog";
import { isHostDialogWindow } from "./ui/hostDialogUtils";

function App() {
  const isHostWindow = typeof window !== "undefined" && isHostDialogWindow();

  if (isHostWindow) {
    return <HostAnswerDialog />;
  }

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [statusTitle, setStatusTitle] = useState<string>("Ready");
  const [statusHint, setStatusHint] = useState<string>("Click Random Battle to begin.");

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ category: string | null }>;
      setActiveCategory(custom.detail?.category ?? null);
    };
    window.addEventListener("battleCategoryChanged", handler);
    return () => window.removeEventListener("battleCategoryChanged", handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ title: string; hint: string }>;
      if (!custom.detail) return;
      setStatusTitle(custom.detail.title);
      setStatusHint(custom.detail.hint);
    };
    window.addEventListener("gameStatusChanged", handler);
    return () => window.removeEventListener("gameStatusChanged", handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ name: string | null; previousName?: string | null; category?: string | null }>;
      if (typeof window !== "undefined" && window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.send("hostDialog:update", custom.detail);
      }
    };
    window.addEventListener("hostAnswerDialogUpdate", handler);
    return () => window.removeEventListener("hostAnswerDialogUpdate", handler);
  }, []);

  return (
    <div
      style={{
        background: "#0b0b0f",
        color: "#1b0ce4ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.6rem",
        padding: "10px 8px 8px",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: "#1555e0ff",
          fontWeight: 800,
          fontSize: "3rem",
          letterSpacing: "2px",
          textTransform: "uppercase",
          margin: "4px 0 0",
        }}
      >
        {activeCategory ?? "THE FLOOR!"}
      </h1>
      <p style={{ color: "#FFC542", marginTop: "-10px", marginBottom: "6px" }}>
        Conquer the floor, one tile at a time!
      </p>
      <div
        style={{
          maxWidth: "760px",
          width: "92%",
          minHeight: "104px",
          padding: "16px 18px",
          background: "#0f1624",
          border: "1px solid #243049",
          borderRadius: "10px",
          color: "#e8edf7",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "35px",
            lineHeight: 1.35,
            letterSpacing: "0.25px",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {statusTitle}
        </div>
        <div
          style={{
            fontSize: "16px",
            color: "#cdd7ef",
            marginTop: "8px",
            lineHeight: 1.5,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {statusHint}
        </div>
      </div>
      <FloorGameContainer />
      <HostAnswerDialogToggle />
    </div>
  );
}

export default App;
