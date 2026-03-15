"use client";

import React, { useState } from "react";
import { NothingCard, TerminalBlink } from "@dennislee928/nothingx-react-components";
import { Terminal as TerminalIcon, Send, Code, Play } from "lucide-react";

interface ApiExplorerProps {
  title: string;
  endpoint: string;
  description: string;
  children: React.ReactNode; // The form/input section
  onExecute: () => Promise<any>;
}

export function ApiExplorer({ title, endpoint, description, children, onExecute }: ApiExplorerProps) {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onExecute();
      setResponse(result);
    } catch (err: any) {
      setError(err.message);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 opacity-50">
          <Code size={14} />
          <span className="text-[10px] font-mono tracking-widest uppercase">API_ENDPOINT: {endpoint}</span>
        </div>
        <h2 className="text-5xl font-black tracking-tighter uppercase">{title}</h2>
        <p className="text-sm text-muted-foreground font-mono uppercase tracking-tighter max-w-2xl">{description}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        {/* Input Section */}
        <div className="lg:col-span-5">
          <NothingCard dark style={{ border: '1px solid #222', padding: 32, background: '#050505' }}>
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black tracking-widest uppercase text-red-500">Request_Parameters</h3>
                <div className="w-2 h-2 rounded-full bg-red-500/20" />
              </div>
              
              <div className="space-y-6">
                {children}
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleExecute}
                  disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl text-xs font-black tracking-[0.3em] uppercase transition-all shadow-[0_0_30px_rgba(255,0,0,0.1)] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? "EXECUTING..." : <><Play size={14} fill="currentColor" /> EXECUTE_CALL</>}
                </button>
              </div>
            </div>
          </NothingCard>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-7">
          <NothingCard dark style={{ border: '1px solid #222', padding: 0, background: '#0a0a0a', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <TerminalIcon size={14} className="text-red-500" />
                <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Response_Terminal</span>
              </div>
              <TerminalBlink />
            </div>
            
            <div className="flex-1 p-6 font-mono text-[11px] overflow-auto scrollbar-hide min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
                   <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                   <p className="tracking-[0.2em]">AWAITING_SERVER_RESPONSE</p>
                </div>
              ) : error ? (
                <div className="text-red-500 space-y-4">
                  <p className="font-black underline">[CRITICAL_FAILURE]</p>
                  <p className="opacity-80">{error}</p>
                </div>
              ) : response ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-green-500 font-black underline">[SUCCESS_200_OK]</p>
                  <pre className="text-white/80 leading-relaxed overflow-x-auto">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-10 py-20 text-center">
                  <Code size={48} strokeWidth={1} />
                  <p className="text-[10px] font-mono mt-4 tracking-[0.3em]">IDLE // NO_DATA_SENT</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-black border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-white/20 uppercase tracking-[0.2em]">
               <span>Protocol: HTTPS/TLS_1.3</span>
               <span>Encoding: application/json</span>
            </div>
          </NothingCard>
        </div>
      </div>
    </div>
  );
}
