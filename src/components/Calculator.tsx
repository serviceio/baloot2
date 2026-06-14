import React, { useState } from "react";

export function Calculator({ 
    scores, 
    onUpdateScore,
    isHost
}: { 
    scores: { team1: number; team2: number },
    onUpdateScore: (t1: number, t2: number) => void,
    isHost: boolean
}) {
  const [t1Input, setT1Input] = useState("");
  const [t2Input, setT2Input] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if(!isHost) return;
    const t1 = parseInt(t1Input) || 0;
    const t2 = parseInt(t2Input) || 0;
    onUpdateScore(t1, t2);
    setT1Input("");
    setT2Input("");
  };

  const progress1 = Math.min((scores.team1 / 152) * 100, 100);
  const progress2 = Math.min((scores.team2 / 152) * 100, 100);

  return (
    <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg w-full max-w-sm ml-auto">
      <h3 className="font-bold text-center text-lg mb-4 text-slate-800">حاسبة البلوت</h3>
      
      <div className="flex justify-between items-center mb-6 px-4">
        <div className="text-center">
          <div className="text-xs text-slate-400 font-bold mb-1">لنا (فريق 1)</div>
          <div className="text-3xl font-black text-indigo-600">{scores.team1}</div>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div className="text-center">
          <div className="text-xs text-slate-400 font-bold mb-1">لهم (فريق 2)</div>
          <div className="text-3xl font-black text-rose-600">{scores.team2}</div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress1}%`}} />
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
              <div className="h-full bg-rose-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress2}%`}} />
          </div>
          <div className="text-center text-xs text-slate-400">الهدف: 152 نقطة</div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <div className="flex gap-3">
            <input 
                type="number" 
                disabled={!isHost}
                value={t1Input} 
                onChange={(e) => setT1Input(e.target.value)} 
                placeholder="نقاط لنا..."
                className="w-1/2 p-2 px-3 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 outline-none disabled:opacity-50 disabled:bg-slate-50"
            />
             <input 
                type="number"
                disabled={!isHost} 
                value={t2Input} 
                onChange={(e) => setT2Input(e.target.value)} 
                placeholder="نقاط لهم..."
                className="w-1/2 p-2 px-3 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/50 outline-none disabled:opacity-50 disabled:bg-slate-50"
            />
        </div>
        {isHost && (
            <button type="submit" className="w-full py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 transition">
                إضافة النقاط
            </button>
        )}
        {!isHost && (
            <div className="text-center text-xs text-rose-500 font-bold bg-rose-50 py-2 rounded">
                المضيف فقط يمكنه التعديل
            </div>
        )}
      </form>
    </div>
  );
}
