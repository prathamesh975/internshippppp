import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Copy, Check, Bot, User, Code2, Pause, Play, Activity, CircleStop } from "lucide-react";
import { useFlowStore } from "@/flowStore";
import { useAppStore } from "@/appStore";
import { buildExportPayload } from "@/utils";

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function ChatPopup({ open, onClose }: ChatPopupProps) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const rf = useFlowStore((s) => s.reactFlowInstance);
  const flowName = useAppStore((s) => s.currentFlowName);

  const executionState = useFlowStore((s) => s.executionState);
  const setExecutionState = useFlowStore((s) => s.setExecutionState);
  const setActiveNodes = useFlowStore((s) => s.setActiveNodes);
  const setNodeResult = useFlowStore((s) => s.setNodeResult);
  const clearNodeResults = useFlowStore((s) => s.clearNodeResults);
  const sessionId = useFlowStore((s) => s.sessionId);
  const setSessionId = useFlowStore((s) => s.setSessionId);
  const setResumeStream = useFlowStore((s) => s.setResumeStream);
  const addTrace = useFlowStore((s) => s.addTrace);
  const traces = useFlowStore((s) => s.traces);

  const activeVersionId = useAppStore((s) => s.activeVersionId);
  const currentFlowId = useAppStore((s) => s.currentFlowId);
  const savedFlows = useAppStore((s) => s.savedFlows);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'json' | 'trace'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentFlow = savedFlows.find((f) => f.id === currentFlowId);
  const activeVersion = currentFlow?.versions?.find((v) => v.id === activeVersionId);
  const effectiveFlowName = activeVersion ? `${flowName} - ${activeVersion.name}` : flowName;

  const viewport = rf?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
  const graphPayload = buildExportPayload(effectiveFlowName, nodes, edges, viewport);
  const graphJson = JSON.stringify(graphPayload, null, 2);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
      if (messages.length === 0) {
        setMessages([
          {
            id: 1,
            role: "system",
            content: `Flow "${effectiveFlowName}" loaded. Check out the canvas to see visual execution!`,
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [open]);

  const processStream = useCallback(async (isResume = false, initialMsg?: string) => {
    try {
      let targetSession = sessionId;
      if (!isResume) {
        clearNodeResults();
        targetSession = "session-" + Date.now();
        setSessionId(targetSession);
      }
      
      setExecutionState("running");
      
      const response = await fetch("http://localhost:8001/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph: graphPayload,
          message: isResume ? undefined : initialMsg,
          session_id: targetSession,
          resume: isResume
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      if (!response.body) throw new Error("ReadableStream not supported");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "");
            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === "node_update") {
                 setActiveNodes([event.node]);
                 setNodeResult(event.node, event.output);
                 if (event.output && event.output.trace) {
                    addTrace(event.output.trace);
                 }
              } else if (event.type === "paused") {
                 setExecutionState("paused");
                 setIsPausing(false);
                 setActiveNodes([]);
                 return; // Exit stream
              } else if (event.type === "end") {
                 const assistantMsg: ChatMessage = {
                   id: Date.now() + 1,
                   role: "assistant",
                   content: event.reply || "Flow completed without output.",
                   timestamp: new Date(),
                 };
                 setMessages((prev) => [...prev, assistantMsg]);
                 setExecutionState("idle");
                 setIsPausing(false);
                 setActiveNodes([]);
              } else if (event.type === "error") {
                 throw new Error(event.detail);
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }
    } catch (error) {
      setExecutionState("idle");
      setIsPausing(false);
      setActiveNodes([]);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "system",
          content: `Backend Error: ${error}`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [graphPayload, setExecutionState, clearNodeResults, setActiveNodes, setNodeResult, sessionId, setSessionId]);

  useEffect(() => {
    setResumeStream(() => {
      processStream(true);
    });
  }, [processStream, setResumeStream]);

  const handleSend = () => {
    if (!input.trim() || executionState !== 'idle') return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const msgText = input.trim();
    setInput("");
    
    processStream(false, msgText);
  };

  const [isPausing, setIsPausing] = useState(false);

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await fetch("http://localhost:8001/api/chat/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = () => {
    processStream(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(graphJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="chat-overlay" onClick={onClose} style={{ display: open ? "flex" : "none" }}>
      <div className="chat-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <Bot size={18} className="chat-header-icon" />
            <div>
              <h3 className="chat-header-title">Live Flow Execution</h3>
              <span className="chat-header-sub">Nodes will highlight as they run!</span>
            </div>
          </div>
          <div className="chat-header-actions">
            {executionState === 'paused' ? (
              <button
                className="chat-json-toggle"
                onClick={handleResume}
                title="Resume Execution"
                style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981", color: "#10b981", fontWeight: 600 }}
              >
                <Play size={14} />
                <span>Resume</span>
              </button>
            ) : (
              <button
                className="chat-json-toggle"
                onClick={handlePause}
                title="Pause Execution"
                disabled={executionState !== 'running' || isPausing}
                style={{ 
                  background: executionState === 'running' ? "rgba(16, 185, 129, 0.1)" : "transparent", 
                  borderColor: executionState === 'running' ? "#10b981" : "var(--border)", 
                  color: executionState === 'running' ? "#10b981" : "var(--text-muted)", 
                  fontWeight: 600,
                  opacity: executionState === 'running' && !isPausing ? 1 : 0.5,
                  cursor: executionState === 'running' && !isPausing ? "pointer" : "not-allowed"
                }}
              >
                <Pause size={14} />
                <span>{isPausing ? "Pausing..." : "Pause"}</span>
              </button>
            )}
            <button
              className={`chat-json-toggle ${viewMode === 'trace' ? "active" : ""}`}
              onClick={() => setViewMode(viewMode === 'trace' ? 'chat' : 'trace')}
              title="View Trace"
            >
              <Activity size={14} />
              <span>Trace</span>
            </button>
            <button
              className={`chat-json-toggle ${viewMode === 'json' ? "active" : ""}`}
              onClick={() => setViewMode(viewMode === 'json' ? 'chat' : 'json')}
              title="View Graph JSON"
            >
              <Code2 size={14} />
              <span>JSON</span>
            </button>
            <button className="chat-close" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {viewMode === 'json' ? (
          <div className="chat-json-view">
            <div className="chat-json-toolbar">
              <span className="chat-json-label">Graph Export Payload</span>
              <button className="chat-json-copy" onClick={handleCopyJson}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <pre className="chat-json-pre">{graphJson}</pre>
          </div>
        ) : viewMode === 'trace' ? (
          <div className="chat-json-view" style={{ padding: '16px', background: 'var(--bg-card)', color: 'var(--text-main)', overflowY: 'auto' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Execution Trace</h4>
            {traces.length === 0 ? (
               <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No trace data available. Run a query to see the execution steps.</div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 {traces.map((t, idx) => (
                   <div key={idx} style={{ 
                     background: 'rgba(0,0,0,0.2)', 
                     border: '1px solid rgba(255,255,255,0.05)',
                     borderRadius: '8px', 
                     padding: '12px',
                     borderLeft: '3px solid var(--accent)'
                   }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                       <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{idx + 1}. {t.node}</span>
                       <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>{t.type}</span>
                     </div>
                     <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                       {t.summary}
                     </div>
                     {t.schema && (
                       <div style={{ marginBottom: '8px' }}>
                         <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>SCHEMA/TOOLS:</span>
                         <pre style={{ margin: '4px 0 0 0', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#a78bfa' }}>
                           {t.schema}
                         </pre>
                       </div>
                     )}
                     {t.input && (
                       <div style={{ marginBottom: '8px' }}>
                         <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>INPUT:</span>
                         <pre style={{ margin: '4px 0 0 0', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-muted)' }}>
                           {t.input}
                         </pre>
                       </div>
                     )}
                     {t.output && (
                       <div>
                         <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>OUTPUT:</span>
                         <pre style={{ margin: '4px 0 0 0', padding: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)' }}>
                           {typeof t.output === 'string' ? t.output : JSON.stringify(t.output, null, 2)}
                         </pre>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            )}
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
                  <div className="chat-msg-avatar">
                    {msg.role === "user" ? (
                      <User size={14} />
                    ) : (
                      <Bot size={14} />
                    )}
                  </div>
                  <div className="chat-msg-content">
                    <p>{msg.content}</p>
                    <span className="chat-msg-time">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-bar">
              {executionState === 'idle' ? (
                <>
                  <input
                    ref={inputRef}
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                  />
                  <button
                    className="chat-send"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    title="Send"
                  >
                    <Send size={16} />
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "center", background: executionState === 'paused' ? "rgba(245, 158, 11, 0.1)" : "var(--bg-base)", padding: "12px", borderRadius: "8px", border: executionState === 'paused' ? "1px solid #f59e0b" : "1px solid var(--border)" }}>
                   <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                     {executionState === 'paused' && <CircleStop size={16} color="#f59e0b" style={{ flexShrink: 0 }} />}
                     <span style={{ fontSize: "13px", fontWeight: executionState === 'paused' ? 600 : 400, color: executionState === 'running' ? "var(--accent)" : "#f59e0b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                       {executionState === 'running' ? "Running flow..." : "Execution Paused."}
                     </span>
                   </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
