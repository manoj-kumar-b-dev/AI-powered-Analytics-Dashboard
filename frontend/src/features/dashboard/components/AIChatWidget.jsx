import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../shared/components/ui/card";
import { useChatStore } from "../../ask-ai/store/chatStore";

export function AIChatWidget({ initialMessages, onOpenFullChat }) {
  const { chatByDataset, addMessage } = useChatStore();
  const widgetMessages = chatByDataset['widget'] || initialMessages || [
    {
      sender: "ai",
      text: "Hello! I am your Vizora AI Assistant. Ask me anything about your active dataset metrics, trends, or anomaly alerts.",
      timestamp: "10:00 AM"
    }
  ];

  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [widgetMessages, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      sender: "user",
      text: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    addMessage('widget', userMessage);
    const query = inputValue.trim().toLowerCase();
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response after delay
    setTimeout(() => {
      let aiText = "I'm analyzing your data sources. Could you clarify which metric or date range you are referring to?";

      if (query.includes("revenue") || query.includes("profit")) {
        aiText = "Our total revenue stands at $139,418.85 with net profit of $58,888.27 (42.2% profit margin), showing strong conversions.";
      } else if (query.includes("sales") || query.includes("product")) {
        aiText = "Direct sales account for roughly 60% of total volume this week. Garden Hose is our top seller at $10,945.88.";
      } else if (query.includes("region") || query.includes("north") || query.includes("europe")) {
        aiText = "North region leads at 27% ($36,573.43), followed by South ($36,149.53). East is at $34,033.80.";
      } else if (query.includes("expense") || query.includes("cost")) {
        aiText = "Total expenses are $80,530.58 across active product transactions. EXPENSES represents a primary operating cost driver.";
      } else if (query.includes("april") || query.includes("drop")) {
        aiText = "Sales dropped in April mainly due to lower order volumes across secondary categories during that period.";
      }

      const aiResponse = {
        sender: "ai",
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      addMessage('widget', aiResponse);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <Card className="flex flex-col min-h-[380px] h-auto border border-[#1F2937] bg-[#111827]/70 backdrop-blur-md rounded-2xl transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-[#8B5CF6]/5 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-lg font-bold text-white tracking-tight">AI Chat</CardTitle>
          <span className="text-[10px] text-slate-400 font-semibold mt-1 tracking-wide">(Ask about your data)</span>
        </div>
        <button 
          onClick={() => onOpenFullChat?.()}
          className="h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          title="Open Full AI Chat"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </CardHeader>

      {/* Messages area */}
      <CardContent className="flex-1 p-6 pt-1 flex flex-col justify-between min-h-[290px]">
        <div
          className="space-y-4 overflow-y-auto flex-1 pr-1 scrollbar-thin"
          style={{ maxHeight: "210px" }}
          ref={scrollRef}
          aria-live="polite"
        >
          {widgetMessages.map((msg, index) => {
            const isUser = msg.sender === "user";

            return (
              <div
                key={index}
                className={`flex gap-2.5 max-w-[88%] ${isUser ? "ml-auto justify-end" : "mr-auto"
                  }`}
              >
                {!isUser && (
                  <div className="h-6 w-6 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}

                <div className="flex flex-col">
                  <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${isUser
                      ? "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white rounded-tr-none"
                      : "bg-slate-100 dark:bg-[#1F2937]/90 text-slate-800 dark:text-gray-100 rounded-tl-none border border-slate-200 dark:border-white/[0.05]"
                    }`}>
                    {msg.text}
                  </div>
                  {/* Message timestamp */}
                  <span className={`text-[9px] text-slate-400 dark:text-gray-500 mt-1 font-medium select-none ${isUser ? "text-right" : "text-left"
                    }`}>
                    {msg.timestamp}
                  </span>
                </div>

                {isUser && (
                  <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-gray-300 flex items-center justify-center shrink-0 mt-1 shadow-sm select-none">
                    <span className="text-[10px] font-bold">U</span>
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-2.5 mr-auto max-w-[88%]" role="status">
              <div className="h-6 w-6 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center shrink-0 mt-1 animate-pulse shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="bg-slate-100 dark:bg-[#1F2937]/90 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-white/[0.05] text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input container at the bottom */}
        <div className="mt-4 relative flex items-center select-none w-full">
          <input
            type="text"
            placeholder="Ask anything about your data..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-10 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-slate-50 dark:bg-[#070B14]/40 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/50 transition-all shadow-sm"
          />
          <button
            onClick={handleSendMessage}
            className="absolute right-1.5 h-7 w-7 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-md shadow-purple-950/20 active:scale-95 shrink-0"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
