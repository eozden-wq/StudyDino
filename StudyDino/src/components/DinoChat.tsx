// src/components/DinoChat.tsx
import * as React from "react";
import { Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import dinoPng from "@/assets/dinosaur.png"; // Ensure this path is correct

// --- 1. Define the Gemini-Style Message Type ---
type Message = {
  id: string;      // Unique ID for React keys
  role: 'user' | 'model'; // 'user' = human, 'model' = AI (Gemini standard)
  text: string;    // The actual content
  timestamp: Date; // Good practice for chat UI
};

export function DinoChat() {
  // --- STRUCTURED DUMMY GEMINI DATA (i thinik its the same)
  const [messages, setMessages] = React.useState<Message[]>([
    { 
      id: '1', 
      role: 'model', 
      text: "ROAR! 🦖 I am DinoBot. I can help you find fossils or identify dinosaurs on the map. What's on your mind?", 
      timestamp: new Date() 
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false); // To show "Thinking..." state
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Add User Message
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: input, 
      timestamp: new Date() 
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // 2. Simulate API Call (Replace this block later with real fetch)
    // const response = await fetch('/api/chat', { body: JSON.stringify({ history: messages }) })
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "RAWR!", 
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsLoading(false);
    }, 1500); // ARBITRATY 1.5s delay (FOR NOW) -> await for gemini
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        {/* The Trigger Button (Visible on Map) */}
        <Button 
            variant="secondary" 
            size="icon" 
            className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-12 h-12 p-0 hover:scale-105 transition-transform"
        >
             <img src={dinoPng} alt="Chat" className="h-6 w-6 object-contain -scale-x-100" />
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="h-[85vh] flex flex-col fixed bottom-0 left-0 right-0 outline-none">
        <DrawerHeader className="border-b px-4 py-3">
          <DrawerTitle className="flex items-center justify-center gap-2 text-lg font-bold text-primary">
             <img src={dinoPng} className="h-8 w-8 -scale-x-100" /> 
             DinoBot Assistant
          </DrawerTitle>
        </DrawerHeader>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full gap-3 ${
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.role === 'model' ? "bg-green-100" : "bg-blue-100"
              }`}>
                  {msg.role === 'model' ? (
                      <img src={dinoPng} className="h-5 w-5 -scale-x-100" />
                  ) : (
                      <User className="h-5 w-5 text-blue-600" />
                  )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-none dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex w-full gap-3">
               <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <img src={dinoPng} className="h-5 w-5 -scale-x-100" />
               </div>
               <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none text-sm text-gray-400 italic">
                  Thinking...
               </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-background pb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 relative"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about dinosaurs..."
              className="flex-1 pr-10 rounded-full border-gray-300 dark:border-gray-700 focus-visible:ring-offset-0"
              disabled={isLoading}
            />
            <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || !input.trim()}
                className="absolute right-0 top-0.25 h-8.5 w-8.5 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}