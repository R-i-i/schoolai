
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Karaoke({ text, language="ru-RU" }) {
  const { toast } = useToast();
  const lines = text.split(/\n+/).filter(Boolean);
  const [current, setCurrent] = useState(0);
  const [listening, setListening] = useState(false);
  const synth = useRef(window.speechSynthesis);
  const recRef = useRef(null);

  useEffect(()=>{
    if(!("webkitSpeechRecognition"in window || "SpeechRecognition"in window)){
      toast({variant:"destructive",title:"Браузер не поддерживает Speech Recognition"}); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = language;
    rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult=e=>{
      const spoken=e.results[0][0].transcript.trim().toLowerCase();
      const target=lines[current].trim().toLowerCase();
      if(spoken===target){
        toast({description:"Отлично!"}); setCurrent(c=>c+1);
      } else { toast({variant:"destructive",title:"Попробуй ещё",description:spoken}); }
      setListening(false);
    };
    rec.onerror=()=>{toast({variant:"destructive",title:"Ошибка распознавания"}); setListening(false);};
    recRef.current=rec;
  },[current,language]);

  function speak(){
    const utter = new SpeechSynthesisUtterance(lines[current]);
    utter.lang = language; synth.current.cancel(); synth.current.speak(utter);
    utter.onend = ()=>{recRef.current.start(); setListening(true);};
  }

  if(current>=lines.length) return <Card className="w-full max-w-lg"><CardContent className="p-6 text-center">Стих выучен!</CardContent></Card>;

  return (
    <Card className="w-full max-w-lg">
      <CardContent className="p-6 space-y-4">
        {lines.map((l,i)=><p key={i} className={i===current?"text-blue-600 font-semibold":i<current?"text-gray-400 line-through":""}>{i<=current?l:""}</p>)}
        <Button className="w-full" onClick={speak} disabled={listening}>
          {listening ? <Loader2 className="animate-spin"/> : "Слушать и повторять"}
        </Button>
      </CardContent>
    </Card>
  );
}
