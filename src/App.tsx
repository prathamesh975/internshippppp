import { ReactFlowProvider } from "@xyflow/react";
import { useAppStore } from "./appStore";
import HomePage from "./components/HomePage";
import EditorPage from "./components/EditorPage";

export default function App() {
  const view = useAppStore((s) => s.view);

  return view === "editor" ? (
    <ReactFlowProvider>
      <EditorPage />
    </ReactFlowProvider>
  ) : (
    <HomePage />
  );
}
