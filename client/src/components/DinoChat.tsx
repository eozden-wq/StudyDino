import * as React from "react";
import { Send, User, PlusCircle, CalendarClock, MapPin, Plus } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import dinoPng from "@/assets/dinosaur.png"; 
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router"; // Import Link for navigation

// Updated Message Type
type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  groupDetails?: {
      id: string;
      name: string;
      startAt: string;
      endAt: string;
  } | null;
  suggestCreateGroup?: boolean; // New Flag
};

interface DinoChatProps {
    onJoinGroup?: (groupId: string) => void;
}

export function DinoChat({ onJoinGroup }: DinoChatProps) {
  const { getAccessTokenSilently } = useAuth0();
  const [messages, setMessages] = React.useState<Message[]>([
    { 
      id: '1', 
      role: 'model', 
      text: "ROAR! 🦖 I am DinoBot. I can help you find groups who share your interests!", 
      timestamp: new Date() 
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: input, 
      timestamp: new Date() 
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch('/api/gemini/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prompt: userMsg.text }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const responseData = data.data; 
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseData.response_text || "I couldn't generate a response.",
        groupDetails: responseData.group_details,
        suggestCreateGroup: responseData.suggest_create_group, // Capture the flag
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMsg]);

    } catch (error) {
      console.error("Error fetching Gemini recommendations:", error);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Oops! Something went wrong. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
      try {
          const date = new Date(dateStr);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ""; }
  };
  
  const formatDate = (dateStr: string) => {
      try {
          const date = new Date(dateStr);
          return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
      } catch (e) { return ""; }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
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

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full gap-3 ${msg.role === 'user' ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === 'model' ? "bg-green-100" : "bg-blue-100"}`}>
                  {msg.role === 'model' ? <img src={dinoPng} className="h-5 w-5 -scale-x-100" /> : <User className="h-5 w-5 text-blue-600" />}
              </div>

              <div className={`max-w-[85%] flex flex-col gap-2`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-800 rounded-tl-none dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"}`}>
                    {msg.text}
                  </div>
                  
                  {/* Option 1: Render Group Details Card */}
                  {msg.role === 'model' && msg.groupDetails && (
                      <div className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm self-start w-full">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CalendarClock className="h-4 w-4 text-green-600" />
                              <span>
                                  {formatDate(msg.groupDetails.startAt)} • {formatTime(msg.groupDetails.startAt)} - {formatTime(msg.groupDetails.endAt)}
                              </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-4 w-4 text-blue-500" />
                              <span>View on Map</span>
                          </div>
                          
                          {onJoinGroup && (
                            <Button 
                                size="sm" 
                                className="w-full mt-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                                onClick={() => msg.groupDetails && onJoinGroup && onJoinGroup(msg.groupDetails.id)}
                            >
                                <PlusCircle className="h-4 w-4" />
                                Join {msg.groupDetails.name}
                            </Button>
                          )}
                      </div>
                  )}

                  {/* Option 2: Render Create Group Button */}
                  {msg.role === 'model' && msg.suggestCreateGroup && (
                      <Link to="/add" className="self-start">
                          <Button 
                            size="sm" 
                            variant="secondary"
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50 gap-2 shadow-sm"
                          >
                            <Plus className="h-4 w-4" />
                            Create New Group
                          </Button>
                      </Link>
                  )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex w-full gap-3">
               <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <img src={dinoPng} className="h-5 w-5 -scale-x-100" />
               </div>
               <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none text-sm text-gray-400 italic">Thinking...</div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-background pb-8">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your interests"
              className="flex-1 pr-10 rounded-full border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white focus-visible:ring-offset-0"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="absolute right-0 top-0.25 h-8.5 w-8.5 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}