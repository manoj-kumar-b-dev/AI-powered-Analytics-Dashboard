import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../shared/components/ui/card";

export function AIChatWidget({ initialMessages }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      sender: "user",
      text: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputValue.trim().toLowerCase();
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response after delay
    setTimeout(() => {
      let aiText = "I'm analyzing your data sources. Could you clarify which metric or date range you are referring to?";
      
      if (query.includes("revenue") || query.includes("profit")) {
        aiText = "Our June revenue stands at $24,530, marking an 18.2% growth. Net profits reached $7,690, up 14.6%, showing strong conversions.";
      } else if (query.includes("sales") || query.includes("product")) {
        aiText = "Direct sales account for roughly 60% of total volume this week. The AI Agent Workspace is our top performer at $6,420.";
      } else if (query.includes("region") || query.includes("america") || query.includes("europe")) {
        aiText = "North America leads at 38% ($5,745), followed by Europe at 28% ($4,233). Asia is growing rapidly at 22% ($3,326).";
      } else if (query.includes("expense") || query.includes("cost")) {
        aiText = "Total expenses are $8,430 (down 3.6% from last month). However, our expense ratio is currently marked as Critical, indicating potential server cost inefficiencies.";
      } else if (query.includes("april") || query.includes("drop")) {
        aiText = "Sales dropped in April mainly due to a 22% decrease in Product A sales and lower marketing spend during that period.";
      }

      const aiResponse = {
        sender: "ai",
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000);
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
          onClick={() => alert("Opening full chat dashboard...")}
          className="h-7 w-7 hover:bg-slate-800/40 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
        >
          <ExternalLink className="h-4 w-4" />
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
          {messages.map((msg, index) => {
            const isUser = msg.sender === "user";
            
            return (
              <div
                key={index}
                className={`flex gap-2.5 max-w-[88%] ${
                  isUser ? "ml-auto justify-end" : "mr-auto"
                }`}
              >
                {!isUser && (
                  <div className="h-6 w-6 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                
                <div className="flex flex-col">
                  <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                    isUser
                      ? "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white rounded-tr-none"
                      : "bg-[#1F2937]/90 text-gray-100 rounded-tl-none border border-white/[0.05]"
                  }`}>
                    {msg.text}
                  </div>
                  {/* Message timestamp */}
                  <span className={`text-[9px] text-gray-500 mt-1 font-medium select-none ${
                    isUser ? "text-right" : "text-left"
                  }`}>
                    {msg.timestamp}
                  </span>
                </div>

                {isUser && (
                  <div className="h-6 w-6 rounded-full bg-slate-800 border border-white/[0.08] text-gray-300 flex items-center justify-center shrink-0 mt-1 shadow-sm select-none">
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
              <div className="bg-[#1F2937]/90 p-3 rounded-2xl rounded-tl-none border border-white/[0.05] text-xs text-gray-400 flex items-center gap-1 shadow-sm">
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
            className="w-full h-10 pl-4 pr-12 rounded-xl border border-[#1F2937] bg-[#070B14]/40 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/50 transition-all shadow-[0_0_10px_rgba(139,92,246,0.1)]"
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
