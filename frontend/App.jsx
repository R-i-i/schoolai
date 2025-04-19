
/* SchoolAI React App – full version */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Star } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import Karaoke from "./Karaoke";

export default function App() {
  const { toast } = useToast();

  // registration state
  const [userId, setUserId] = useState(localStorage.getItem("userId") || "");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [grade, setGrade] = useState(5);
  const [nativeLanguage, setNativeLanguage] = useState("ru");

  // task state
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("math");
  const [steps, setSteps] = useState([]);

  // ui state
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState({ total: 0, monthly: 0 });

  async function fetchProgress(id) {
    if (!id) return;
    try {
      const res = await fetch(`/user/progress/${id}`);
      if (!res.ok) throw new Error("progress error");
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      toast({ variant: "destructive", title: "Ошибка прогресса", description: err.message });
    }
  }

  useEffect(() => { if (userId) fetchProgress(userId); }, [userId]);

  async function handleRegister() {
    try {
      const payload = { full_name: fullName, birth_date: birthDate, grade: Number(grade), native_language: nativeLanguage };
      const res = await fetch("/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("register error");
      const data = await res.json();
      setUserId(data.user_id);
      localStorage.setItem("userId", data.user_id);
      toast({ description: "Регистрация успешна" });
      fetchProgress(data.user_id);
    } catch (e) {
      toast({ variant: "destructive", title: "Ошибка регистрации", description: e.message });
    }
  }

  async function handleOCR() {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/media/ocr", { method: "POST", body: form });
      if (!res.ok) throw new Error("OCR error");
      const data = await res.json();
      setText(data.text || "");
    } catch (e) {
      toast({ variant: "destructive", title: "Ошибка OCR", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSolveStream() {
    if (!text) return;
    setSteps([]);
    setStreaming(true);
    try {
      const payload = { input_type: "text", payload: text, subject, grade: Number(grade), language: nativeLanguage };
      const res = await fetch("/task/solve/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) throw new Error("SSE error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (chunk.startsWith("data:")) {
            const json = chunk.slice(5);
            try {
              const step = JSON.parse(json);
              setSteps((p) => [...p, step]);
            } catch {}
          }
        }
      }
      if (userId) await fetch(`/user/reward/${userId}`, { method: "POST" });
      fetchProgress(userId);
      toast({ description: "Звёздочка добавлена!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Ошибка LLM", description: e.message });
    } finally {
      setStreaming(false);
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-center">Регистрация</h2>
            <Input placeholder="ФИО" value={fullName} onChange={(e)=>setFullName(e.target.value)}/>
            <Input type="date" value={birthDate} onChange={(e)=>setBirthDate(e.target.value)}/>
            <Input type="number" min={1} max={11} value={grade} onChange={(e)=>setGrade(e.target.value)} placeholder="Класс"/>
            <select className="w-full p-2 rounded border" value={nativeLanguage} onChange={(e)=>setNativeLanguage(e.target.value)}>
              <option value="ru">Русский</option><option value="en">English</option><option value="sah">Yakut</option>
            </select>
            <Button onClick={handleRegister} disabled={!fullName || !birthDate}>Продолжить</Button>
          </CardContent>
        </Card><Toaster/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 space-y-6">
      <h1 className="text-3xl font-bold mt-4 flex items-center gap-2">
        SchoolAI <Star className="text-yellow-500"/> {progress.total}
      </h1>
      {/* progress */}
      <Card className="w-full max-w-xl"><CardContent className="p-4">
        <h3 className="font-semibold mb-2">Звёзды за месяц: {progress.monthly}</h3>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={[{name:"stars",value:progress.monthly}]}>
            <XAxis dataKey="name" hide/><YAxis hide domain={[0, Math.max(progress.monthly,1)]}/><Tooltip/>
            <Area type="monotone" dataKey="value" stroke="currentColor" fillOpacity={0.15} fill="currentColor"/>
          </AreaChart>
        </ResponsiveContainer>
      </CardContent></Card>

      {/* task */}
      <Card className="w-full max-w-xl"><CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="font-semibold">Фото задания</label>
          <Input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files[0])}/>
          <Button onClick={handleOCR} disabled={!file || loading}>{loading ? <Loader2 className="animate-spin"/> : "Распознать текст"}</Button>
        </div>
        <div className="space-y-2">
          <label className="font-semibold">Текст задания</label>
          <Textarea rows={5} value={text} onChange={(e)=>setText(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">Предмет</label>
            <select className="w-full p-2 rounded border" value={subject} onChange={(e)=>setSubject(e.target.value)}>
              <option value="math">Математика</option>
              <option value="russian">Русский язык</option>
              <option value="literature">Литература</option>
              <option value="music">Музыка</option>
            </select>
          </div>
          <div>
            <label className="font-semibold">Класс</label>
            <Input type="number" min={1} max={11} value={grade} onChange={(e)=>setGrade(e.target.value)}/>
          </div>
        </div>
        <Button className="w-full" onClick={handleSolveStream} disabled={!text || streaming}>
          {streaming ? <Loader2 className="animate-spin"/> : "Показать шаги решения"}
        </Button>
      </CardContent></Card>

      {/* steps */}
      {steps.length>0 && <div className="w-full max-w-xl space-y-3">
        {steps.map((s,i)=>(<Card key={i} className="border-l-4 border-blue-600"><CardContent className="p-4">
          <p className="font-medium capitalize mb-1">{s.type}</p><p>{s.content}</p>
        </CardContent></Card>))}
      </div>}

      {/* karaoke only for literature/music */}
      {(steps.length>0 && (subject==="literature"||subject==="music")) && (
        <Karaoke text={text} language={nativeLanguage==="en" ? "en-US" : "ru-RU"}/>
      )}

      <Toaster/>
    </div>
  );
}
