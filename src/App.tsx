import React, { useEffect, useState } from "react";
import { socket } from "./socket";
import { GameState, Card, Suit } from "./types";
import { useWebRTC } from "./hooks/useWebRTC";
import { AudioPlayer } from "./components/AudioPlayer";
import { Calculator } from "./components/Calculator";
import { CardView } from "./components/CardView";
import { Calculator as CalculatorIcon, Mic, MicOff, Play, List, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STYLED_SUITS = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

export default function App() {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string>("");

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);

  const [bidHukumSuitState, setBidHukumSuitState] = useState<Suit | null>(null);

  const [calcOpen, setCalcOpen] = useState(false);
  const [showLogConfirm, setShowLogConfirm] = useState(false);

  const [projectMode, setProjectMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);

  const { remoteStreams } = useWebRTC(localStream);

  const toggleMic = async () => {
      if (micEnabled && localStream) {
          localStream.getTracks().forEach(t => t.stop());
          setLocalStream(null);
          setMicEnabled(false);
      } else {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              setLocalStream(stream);
              setMicEnabled(true);
          } catch (err) {
              console.error("Mic error:", err);
          }
      }
  };

  useEffect(() => {
      socket.on("connect", () => {
          setMyId(socket.id!);
      });

      socket.on("game-state", (state: GameState) => {
          setGameState(state);
      });

      return () => {
          socket.off("connect");
          socket.off("game-state");
      };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
      e.preventDefault();
      if (name) {
          socket.connect();
          socket.emit("login", { name });
          setJoined(true);
      }
  };

  const attemptToggleLog = () => {
      if (gameState?.showLog) {
          socket.emit("toggle-log");
      } else {
          if (gameState?.status === "playing" || gameState?.status === "bidding") {
              if (me?.isHost) {
                  setShowLogConfirm(true);
              } else {
                  alert("فقط المضيف يمكنه كشف القيد أثناء جولة شغالة.");
              }
          } else {
              socket.emit("toggle-log");
          }
      }
  };

  if (!joined) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
              <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
              >
                  <div className="flex justify-center mb-8">
                     <div className="w-16 h-16 bg-slate-900 flex items-center justify-center rounded-2xl rotate-12 shadow-md">
                        <span className="text-3xl text-white font-black -rotate-12">♥</span>
                     </div>
                  </div>
                  <h1 className="text-3xl font-black text-center text-slate-900 mb-2">لعبة بلوت</h1>
                  <p className="text-center text-slate-500 mb-8 mx-auto text-sm">أدخل اسمك لتدخل الغرفة الرئيسية.</p>
                  
                  <form onSubmit={handleJoin} className="space-y-4">
                      <div>
                          <input 
                              type="text" 
                              required
                              value={name} 
                              onChange={(e) => setName(e.target.value)} 
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-center font-bold text-lg" 
                              placeholder="أبو فلان..."
                          />
                      </div>
                      <button 
                          type="submit" 
                          className="w-full py-4 mt-6 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition active:scale-95"
                      >
                          دخول
                      </button>
                  </form>
              </motion.div>
          </div>
      );
  }

  if (!gameState) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">جاري الاتصال...</div>;

  const me = gameState.players.find(p => p.id === myId);
  
  // Use activePlayerIds to check turn cleanly
  const myActiveIndex = gameState.activePlayerIds.indexOf(myId);
  const isMyTurn = myActiveIndex !== -1 && myActiveIndex === gameState.turnIndex;
  const currentTurnPlayer = gameState.players.find(p => p.id === gameState.activePlayerIds[gameState.turnIndex]);

  const viewIdx = myActiveIndex !== -1 ? myActiveIndex : 0;
  
  const getPlayerPosition = (idx: number) => {
       const diff = (idx - viewIdx + 4) % 4;
       if (diff === 0) return "bottom";
       if (diff === 1) return "right";
       if (diff === 2) return "top";
       if (diff === 3) return "left";
       return "bottom";
  };

  const renderPlayerAvatar = (realIdx: number) => {
       const pId = gameState.activePlayerIds[realIdx];
       const p = gameState.players.find(x => x.id === pId);
       if (!p) return null;
       
       const pos = getPlayerPosition(realIdx);
       const isTurn = gameState.turnIndex === realIdx;
       const isDealer = gameState.dealerIndex === realIdx;

       let placementClasses = "";
       if (pos === "bottom") placementClasses = "bottom-[130px] md:bottom-[160px] left-1/2 -translate-x-1/2"; 
       if (pos === "right") placementClasses = "right-4 md:right-8 top-1/2 -translate-y-1/2 flex-col";
       if (pos === "left") placementClasses = "left-4 md:left-8 top-1/2 -translate-y-1/2 flex-col";
       if (pos === "top") placementClasses = "top-20 md:top-24 left-1/2 -translate-x-1/2"; 

       return (
            <div key={realIdx} className={`absolute ${placementClasses} flex items-center gap-2 z-20 transition-all duration-300 ${isTurn ? 'scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'opacity-80'}`}>
                 <div className={`relative w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-lg md:text-xl text-white shadow-lg border-2 ${isTurn ? 'bg-amber-500 border-amber-300 ring-4 ring-amber-500/30' : 'bg-slate-800 border-slate-600'}`}>
                      {p.name.substring(0, 2)}
                      {isDealer && <div className="absolute -top-2 -left-2 bg-indigo-600 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black shadow shadow-black ring-2 ring-white z-10 text-white">M</div>}
                 </div>
                 <div className={`bg-black/60 text-white px-3 py-1 rounded-full whitespace-nowrap backdrop-blur-sm text-xs md:text-sm ${pos === 'right' ? 'order-first md:order-last' : ''}`}>
                      {p.name} {isTurn ? " (دوره)" : ""}
                 </div>
            </div>
       );
  };

  return (
    <div className="min-h-[100dvh] bg-[#0A3D2E] flex flex-col font-sans overflow-hidden fixed inset-0" dir="rtl">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-50 fixed top-0 w-full">
            <div className="flex items-center gap-4">
                <div className="font-black text-xl flex items-center gap-2">
                    <span className="text-rose-600 border border-slate-200 px-2 rounded-md bg-slate-50">♥</span>
                    بلوت
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 rounded-lg p-1">
                    <button 
                        onClick={attemptToggleLog}
                        className={`p-2 px-3 sm:px-4 font-bold rounded-md transition ${gameState.showLog ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-200'} flex items-center gap-2 text-xs sm:text-sm`}
                    >
                        <List size={16} />
                        <span className="hidden sm:inline">سجل اللعب</span>
                    </button>
                    <button 
                        onClick={() => setCalcOpen(true)}
                        className={`p-2 px-3 sm:px-4 font-bold rounded-md transition text-slate-700 hover:bg-slate-200 flex items-center gap-2 text-xs sm:text-sm`}
                    >
                        <CalculatorIcon size={16} />
                        <span className="hidden sm:inline">الحاسبة</span>
                    </button>
                </div>
                
                <button 
                    onClick={toggleMic}
                    className={`p-2.5 rounded-full transition shadow-sm border ${micEnabled ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white border-slate-200 text-slate-400'}`}
                >
                    {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <div className="hidden sm:flex -space-x-2 -space-x-reverse mr-2">
                    {gameState.players.map((p) => (
                        <div key={p.id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] shadow-sm relative group overflow-visible">
                            {p.name.charAt(0)}
                            <div className="absolute top-10 whitespace-nowrap bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {p.name} {remoteStreams[p.id] && " (يتحدث)"}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </header>

        {Object.entries(remoteStreams).map(([id, stream]) => (
            <AudioPlayer key={id} stream={stream as MediaStream} />
        ))}

        <AnimatePresence>
            {showLogConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100">
                         <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                              <List size={24} />
                         </div>
                         <h3 className="text-xl font-black text-center text-slate-900 mb-2">تأكيد كشف القيد</h3>
                         <p className="text-center text-slate-500 font-medium leading-relaxed mb-6">فتح سجل اللعب (القيد) الآن سيؤدي إلى <strong className="text-rose-600">إنهاء الجولة الحالية</strong> فوراً وكشف الأوراق للجميع.</p>
                         <div className="flex gap-3">
                              <button onClick={() => setShowLogConfirm(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">إلغاء</button>
                              <button onClick={() => { setShowLogConfirm(false); socket.emit("toggle-log"); }} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition">نعم، اكشف</button>
                         </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {gameState.showLog && (
                 <motion.div 
                     initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                     className="absolute inset-0 z-40 bg-slate-900/90 backdrop-blur-sm p-4 overflow-y-auto"
                 >
                     <div className="max-w-3xl mx-auto mt-16 md:mt-24">
                          <div className="bg-white rounded-3xl p-6 shadow-2xl pb-12">
                               <div className="flex justify-between items-center flex-wrap mb-8">
                                   <h2 className="text-3xl font-black text-slate-900">سجل القيد (اللعب)</h2>
                                   <button onClick={() => socket.emit("toggle-log")} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200">إغلاق</button>
                               </div>
                               {gameState.tricks.length === 0 && !gameState.players.some(p => p.hand && p.hand.length > 0) && gameState.tableCards.length === 0 ? (
                                   <div className="text-center text-slate-400 font-bold py-12">لا توجد أوراق مقيدة حتى الآن</div>
                               ) : (
                                   <div className="flex flex-col gap-12">
                                       {gameState.tricks.length > 0 && (
                                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                               <div>
                                           <h3 className="text-xl font-black text-indigo-900 mb-4 border-b-2 border-indigo-100 pb-2">أكلات الفريق الأول (لنا)</h3>
                                           <div className="space-y-4">
                                               {gameState.tricks.filter(t => gameState.players.find(x => x.id === t.winnerId)?.team === 1).map((t, i) => (
                                                   <div key={i} className="flex flex-col items-center gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                                                       <div className="flex gap-4 justify-center">
                                                           {t.cards.map((c, j) => (
                                                                <div key={j} className="flex flex-col items-center gap-1">
                                                                    <div className="scale-[0.6] origin-top h-[86px] w-[58px]">
                                                                        <CardView suit={c.card.suit} value={c.card.rank} index={0} />
                                                                    </div>
                                                                    <div className="z-10 relative text-[10px] bg-white border border-indigo-100 px-2 py-0.5 rounded-full text-indigo-600 whitespace-nowrap shadow-sm">
                                                                        {gameState.players.find(x => x.id === c.playerId)?.name}
                                                                    </div>
                                                                </div>
                                                           ))}
                                                       </div>
                                                       <div className="text-sm font-bold bg-white px-3 py-1 rounded-lg border border-indigo-200 text-indigo-700">
                                                           لمة: {gameState.players.find(x => x.id === t.winnerId)?.name}
                                                       </div>
                                                   </div>
                                               ))}
                                           </div>
                                       </div>
                                       <div>
                                           <h3 className="text-xl font-black text-rose-900 mb-4 border-b-2 border-rose-100 pb-2">أكلات الفريق الثاني (لهم)</h3>
                                           <div className="space-y-4">
                                               {gameState.tricks.filter(t => gameState.players.find(x => x.id === t.winnerId)?.team === 2).map((t, i) => (
                                                   <div key={i} className="flex flex-col items-center gap-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm overflow-hidden">
                                                       <div className="flex gap-4 justify-center">
                                                           {t.cards.map((c, j) => (
                                                                <div key={j} className="flex flex-col items-center gap-1">
                                                                    <div className="scale-[0.6] origin-top h-[86px] w-[58px]">
                                                                        <CardView suit={c.card.suit} value={c.card.rank} index={0} />
                                                                    </div>
                                                                    <div className="z-10 relative text-[10px] bg-white border border-rose-100 px-2 py-0.5 rounded-full text-rose-600 whitespace-nowrap shadow-sm">
                                                                        {gameState.players.find(x => x.id === c.playerId)?.name}
                                                                    </div>
                                                                </div>
                                                           ))}
                                                       </div>
                                                       <div className="text-sm font-bold bg-white px-3 py-1 rounded-lg border border-rose-200 text-rose-700">
                                                           لمة: {gameState.players.find(x => x.id === t.winnerId)?.name}
                                                       </div>
                                                   </div>
                                               ))}
                                           </div>
                                       </div>
                                        </div>
                                        )}
                                       {/* Hands Remaining */}
                                       {(gameState.players.some(p => p.hand && p.hand.length > 0)) && (
                                           <div className="mt-4">
                                               <h3 className="text-xl font-black text-slate-900 mb-6 border-b-2 border-slate-100 pb-3">الأوراق المتبقية في يد كل لاعب</h3>
                                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                   {gameState.players.filter(p => p.hand && p.hand.length > 0).map((p, i) => (
                                                       <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                                           <div className="font-bold text-slate-800 text-lg mb-4">{p.name}</div>
                                                           <div className="flex flex-wrap gap-2">
                                                                {p.hand.map((c, j) => c ? (
                                                                    <div key={j} className="scale-[0.8] origin-top w-[77px] h-[115px]">
                                                                         <CardView suit={c.suit} value={c.rank} index={0} />
                                                                    </div>
                                                                ) : null)}
                                                           </div>
                                                       </div>
                                                   ))}
                                               </div>
                                           </div>
                                       )}
                                       {gameState.tableCards.length > 0 && (
                                            <div className="mt-4">
                                                <h3 className="text-xl font-black text-amber-900 mb-6 border-b-2 border-amber-100 pb-3">أوراق على الطاولة (لم تكتمل)</h3>
                                                <div className="flex justify-center gap-4 bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm">
                                                    {gameState.tableCards.map((c, idx) => (
                                                         <div key={idx} className="flex flex-col items-center gap-1">
                                                              <div className="scale-[0.8] origin-top w-[77px] h-[115px]">
                                                                  <CardView suit={c.card.suit} value={c.card.rank} index={0} />
                                                              </div>
                                                              <div className="text-xs font-bold text-amber-700 bg-white px-2 py-1 rounded shadow-sm">{gameState.players.find(p => p.id === c.playerId)?.name}</div>
                                                         </div>
                                                    ))}
                                                </div>
                                            </div>
                                       )}
                                   </div>
                               )}
                          </div>
                     </div>
                 </motion.div>
            )}
        </AnimatePresence>

        {/* Calculator Drawer */}
        <AnimatePresence>
            {calcOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setCalcOpen(false)}
                        className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col pt-16 overflow-y-auto"
                    >
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 mt-2">
                            <h2 className="font-black text-xl text-slate-800">حاسبة البلوت والمشاريع</h2>
                            <button onClick={() => setCalcOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 flex-1">
                            {/* Notice: Masharee3 logic overlaps here. Manual overrides allow perfect control. */}
                            <Calculator scores={gameState.scores} isHost={me?.isHost || false} onUpdateScore={(t1, t2) => socket.emit("update-score", { team1: t1, team2: t2 })} />
                            
                            <div className="mt-8 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                <h4 className="font-bold text-amber-800 mb-2">حساب يدوي بالكامل</h4>
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">النقاط لا تحسب تلقائياً. المضيف يقوم بحساب أكلات الفرق وإضافتها مع المشاريع من هنا. يمكنك كشف القيد لرؤية الأكلات لكل فريق.</p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {gameState.status === "lobby" && (
            <main className="flex-1 w-full mx-auto p-4 md:p-8 mt-16 overflow-y-auto bg-[#F0F4F8]">
                {gameState.scores.team1 >= 152 || gameState.scores.team2 >= 152 ? (
                    <div className="text-center bg-white p-8 md:p-12 rounded-3xl shadow-xl max-w-2xl mx-auto border-4 border-amber-400">
                        <div className="text-6xl mb-6">🏆</div>
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 leading-snug">
                            فاز {gameState.scores.team1 >= 152 ? "الفريق الأول (لنا)" : "الفريق الثاني (لهم)"}!
                        </h2>
                        <div className="text-lg md:text-2xl text-slate-600 font-bold mb-10 flex items-center justify-center gap-2">
                            <span>النتيجة النهائية:</span>
                            <span dir="ltr" className="whitespace-nowrap">{gameState.scores.team1} - {gameState.scores.team2}</span>
                        </div>
                        {me?.isHost && (
                            <button onClick={() => socket.emit("reset-game")} className="px-8 py-4 md:px-10 md:py-5 bg-amber-500 text-white font-black text-xl md:text-2xl rounded-2xl shadow-xl hover:bg-amber-400 focus:scale-95 transition-all">
                                بدء صكة جديدة
                            </button>
                        )}
                    </div>
                ) : (gameState.tricks.length > 0 || gameState.scores.team1 > 0 || gameState.scores.team2 > 0) ? (
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-10 mt-8">
                            <h2 className="text-4xl font-black text-slate-900 mb-4">النتيجة الحالية</h2>
                            <div className="flex justify-center items-center gap-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-lg mx-auto">
                                <div className="text-center flex-1">
                                    <div className="text-sm font-bold text-indigo-500 mb-2">الفريق الأول (لنا)</div>
                                    <div className="text-5xl font-black text-indigo-900">{gameState.scores.team1}</div>
                                </div>
                                <div className="text-3xl text-slate-300 font-black">-</div>
                                <div className="text-center flex-1">
                                    <div className="text-sm font-bold text-rose-500 mb-2">الفريق الثاني (لهم)</div>
                                    <div className="text-5xl font-black text-rose-900">{gameState.scores.team2}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center mt-12">
                            {me?.isHost ? (
                                <button 
                                    onClick={() => socket.emit("start-game")}
                                    className="px-12 py-5 bg-slate-900 text-white font-black text-xl rounded-full shadow-2xl hover:bg-slate-800 flex items-center gap-4 transition-transform hover:-translate-y-1"
                                >
                                    <Play size={24} fill="currentColor" />
                                    توزيع الجولة القادمة
                                </button>
                            ) : (
                                <div className="text-slate-500 font-bold bg-white px-8 py-4 rounded-full shadow-sm border border-slate-100 text-lg">
                                    بانتظار المضيف لمتابعة اللعب...
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-10 mt-8">
                            <h2 className="text-3xl font-black text-slate-900 mb-2">توزيع الفرق</h2>
                            <p className="text-slate-500">اختر فريقك. نحتاج 4 للعب والبقية مشاهدين.</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-indigo-50">
                        <h3 className="text-2xl font-black text-indigo-900 mb-6">الفريق الأول (لنا)</h3>
                        <div className="space-y-3">
                            {gameState.players.filter(p => p.team === 1).map(p => (
                                <div key={p.id} className="font-bold flex items-center gap-3 bg-indigo-50/50 p-3 rounded-lg text-indigo-900 border border-indigo-100">
                                    <CheckCircle2 className="text-indigo-500" size={18} />
                                    {p.name} {p.id === myId && "(أنت)"}
                                </div>
                            ))}
                            {gameState.players.filter(p => p.team === 1).length < 2 && (
                                <button onClick={() => socket.emit("join-team", 1)} className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition">
                                    + انضمام للفريق
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-rose-50">
                        <h3 className="text-2xl font-black text-rose-900 mb-6">الفريق الثاني (لهم)</h3>
                        <div className="space-y-3">
                            {gameState.players.filter(p => p.team === 2).map(p => (
                                <div key={p.id} className="font-bold flex items-center gap-3 bg-rose-50/50 p-3 rounded-lg text-rose-900 border border-rose-100">
                                    <CheckCircle2 className="text-rose-500" size={18} />
                                    {p.name} {p.id === myId && "(أنت)"}
                                </div>
                            ))}
                            {gameState.players.filter(p => p.team === 2).length < 2 && (
                                <button onClick={() => socket.emit("join-team", 2)} className="w-full py-3 border-2 border-dashed border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50 transition">
                                    + انضمام للفريق
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                </div>
                )}

                {!(gameState.scores.team1 >= 152 || gameState.scores.team2 >= 152) && !(gameState.tricks.length > 0 || gameState.scores.team1 > 0 || gameState.scores.team2 > 0) && (
                    <div className="flex justify-center">
                        {me?.isHost ? (
                            <button 
                                onClick={() => socket.emit("start-game")}
                                disabled={gameState.players.filter(p => p.team === 1).length < 2 || gameState.players.filter(p => p.team === 2).length < 2}
                                className="px-10 py-4 bg-slate-900 text-white font-black rounded-full shadow-xl hover:bg-slate-800 disabled:opacity-50 flex items-center gap-3 transition"
                            >
                                <Play size={20} fill="currentColor" />
                                وزع وابدأ
                            </button>
                        ) : (
                            <div className="text-slate-500 font-bold bg-white px-6 py-3 rounded-full shadow-sm border border-slate-100">
                                بانتظار المضيف (الموزع) لبدء اللعبة...
                            </div>
                        )}
                    </div>
                )}
            </main>
        )}

        {(gameState.status === "playing" || gameState.status === "bidding") && (
            <main className="flex-1 relative flex flex-col justify-center items-center pb-safe overflow-hidden mt-[60px] w-full">
                {/* Visual Avatars */}
                {gameState.activePlayerIds.map((_, i) => renderPlayerAvatar(i))}
                
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">

                    {gameState.status === "bidding" && (
                         <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center p-4 backdrop-blur-sm pointer-events-auto">
                              <h2 className="text-white text-3xl font-black mb-10 drop-shadow-lg tracking-widest tracking-loose">
                                  مرحلة الشراء {gameState.bidPhase === 2 ? "(الثاني)" : ""}
                              </h2>
                              
                              {gameState.publicCard && (
                                  <div className="scale-125 md:scale-150 mb-12 shadow-[0_0_50px_rgba(255,255,255,0.2)] rounded-lg">
                                      <CardView suit={gameState.publicCard.suit} value={gameState.publicCard.rank} index={0} />
                                  </div>
                              )}

                              {isMyTurn ? (
                                  <div className="flex flex-col gap-4 items-center">
                                      <div className="flex flex-wrap items-center justify-center gap-4">
                                          <button onClick={() => socket.emit("bid", { action: "sun" })} className="px-6 py-3 md:px-10 md:py-4 bg-amber-500 text-white font-black text-xl md:text-2xl rounded-2xl shadow-lg hover:bg-amber-400 transition transform hover:-translate-y-1">
                                              صن
                                          </button>
                                          
                                          {!gameState.currentBid && (
                                              <>
                                                  {gameState.bidPhase === 1 ? (
                                                      <button onClick={() => socket.emit("bid", { action: "hukum" })} className="px-6 py-3 md:px-10 md:py-4 bg-rose-600 text-white font-black text-xl md:text-2xl rounded-2xl shadow-lg hover:bg-rose-500 transition transform hover:-translate-y-1">
                                                          حكم
                                                      </button>
                                                  ) : (
                                                      <div className="flex bg-rose-600 text-white rounded-2xl shadow-lg overflow-hidden group">
                                                          <button onClick={() => {
                                                              if(bidHukumSuitState) socket.emit("bid", { action: "hukum", suit: bidHukumSuitState });
                                                          }} disabled={!bidHukumSuitState} className="px-4 py-3 md:px-8 md:py-4 font-black text-xl md:text-2xl hover:bg-rose-500 disabled:opacity-50">
                                                              حكم
                                                          </button>
                                                          <select 
                                                              className="bg-rose-700 text-white px-2 md:px-4 outline-none border-r border-rose-500/50 appearance-none font-bold text-center cursor-pointer text-lg md:text-xl" 
                                                              value={bidHukumSuitState || ""}
                                                              onChange={e => setBidHukumSuitState(e.target.value as Suit)}
                                                          >
                                                              <option value="" disabled>لون</option>
                                                              {(["hearts", "spades", "diamonds", "clubs"] as Suit[]).filter(s => s !== gameState.publicCard?.suit).map(s => (
                                                                  <option key={s} value={s}>{STYLED_SUITS[s]}</option>
                                                              ))}
                                                          </select>
                                                      </div>
                                                  )}

                                                  {gameState.bidPhase === 2 && (
                                                      <button onClick={() => socket.emit("bid", { action: "ashkal" })} className="px-6 py-3 md:px-10 md:py-4 bg-indigo-600 text-white font-black text-xl md:text-2xl rounded-2xl shadow-lg hover:bg-indigo-500 transition transform hover:-translate-y-1">
                                                          أشكل
                                                      </button>
                                                  )}
                                              </>
                                          )}

                                          <button onClick={() => socket.emit("bid", { action: "pass" })} className="px-6 py-3 md:px-10 md:py-4 bg-slate-700 text-white font-black text-xl md:text-2xl rounded-2xl shadow-lg hover:bg-slate-600 transition transform hover:-translate-y-1">
                                              بس
                                          </button>
                                      </div>
                                      {gameState.bidPhase === 2 && !gameState.currentBid && (
                                          <div className="text-white/80 text-sm md:text-base mt-4 tracking-wide font-medium bg-black/40 px-6 py-2 rounded-full">
                                              اختر لون الحكم من القائمة قبل الشراء
                                          </div>
                                      )}
                                      {gameState.currentBid && (
                                          <div className="text-white/90 text-sm md:text-base mt-4 tracking-wide font-bold bg-amber-500/20 border border-amber-500/50 px-6 py-2 rounded-full">
                                              تم شراء حكم بانتظار صن أو بس
                                          </div>
                                      )}
                                  </div>
                              ) : (
                                  <div className="text-white text-xl md:text-2xl font-bold animate-pulse mt-4 bg-black/40 px-6 py-3 rounded-2xl">
                                      بانتظار: {currentTurnPlayer?.name}...
                                  </div>
                              )}
                              
                              {me?.hand && me.hand.length === 5 && me.hand.every(c => c.rank === "7" || c.rank === "8" || c.rank === "9") && (
                                   <div className="mt-8 relative z-50">
                                       <button onClick={() => socket.emit("kashoo")} className="px-6 py-3 border-2 border-white/40 bg-black/50 backdrop-blur-md text-white font-bold rounded-2xl hover:bg-white/20 transition shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                           إعلان كاشو (أوراقك فقط من 7, 8, 9)
                                       </button>
                                   </div>
                               )}
                         </div>
                    )}

                    {gameState.status === "playing" && (
                         <div className="absolute inset-0 flex items-center justify-center p-4 z-10 pointer-events-none">
                              {gameState.currentBid && (
                                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 border border-white/10 backdrop-blur px-8 py-2 rounded-full text-white md:text-xl font-bold tracking-wider shadow-xl z-50">
                                      المشترى: {gameState.currentBid.type === "sun" ? "صن" : `حكم ${STYLED_SUITS[gameState.currentBid.suit!]}`}
                                  </div>
                              )}
                              
                              {/* Display Revealed Projects */}
                              {gameState.revealedProjects && gameState.revealedProjects.length > 0 && (
                                  <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col gap-4 z-50">
                                      {gameState.revealedProjects.map((p, pIdx) => {
                                          const playerName = gameState.players.find(x => x.id === p.playerId)?.name;
                                          return (
                                              <div key={pIdx} className="bg-black/70 backdrop-blur pb-4 pt-8 px-6 rounded-3xl border border-amber-500/30 flex flex-col items-center shadow-2xl relative">
                                                  <div className="absolute -top-4 bg-amber-500 text-amber-950 font-black px-4 py-1 rounded-full shadow border-2 border-white">
                                                      مشروع {playerName}
                                                  </div>
                                                  <div className="flex justify-center gap-1">
                                                      {p.cards.map((c, i) => (
                                                          <div key={i} className="scale-75 origin-top w-12 h-16 pointer-events-auto">
                                                              <CardView suit={c.suit} value={c.rank} index={0} />
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}

                              <div className="relative flex items-center justify-center">
                                  {gameState.tableCards.map((pc, i) => {
                                      const ownerIdx = gameState.activePlayerIds.indexOf(pc.playerId);
                                      const pos = getPlayerPosition(ownerIdx);
                                      
                                      let translate = "translate(0, 0)";
                                      if (pos === "bottom") translate = "translate(0, 50px)";
                                      if (pos === "top") translate = "translate(0, -50px)";
                                      if (pos === "left") translate = "translate(-50px, 0)";
                                      if (pos === "right") translate = "translate(50px, 0)";

                                      return (
                                          <div key={i} className="absolute transform transition-transform duration-300 drop-shadow-2xl" style={{ 
                                                transform: `${translate} rotate(${i * 15 - 20}deg)`,
                                                zIndex: i
                                          }}>
                                              <div className="scale-90 md:scale-110">
                                                  <CardView suit={pc.card.suit} value={pc.card.rank} index={0} />
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                         </div>
                    )}

                    {/* Self Hand Card Visualization - ARCS */}
                    {me && myActiveIndex !== -1 && (
                         <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30 pointer-events-auto">
                              {/* Project Mode Toggle */}
                              {gameState.status === "playing" && (
                                  <div className="absolute -top-28 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur px-4 py-2 rounded-full whitespace-nowrap">
                                       {projectMode ? (
                                           <>
                                               <button 
                                                   onClick={() => {
                                                       if(me.hand!.length < 8) { socket.emit("reveal-project", selectedCards); setSelectedCards([]); } setProjectMode(false);
                                                   }}
                                                   disabled={selectedCards.length === 0}
                                                   className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-bold rounded-full transition"
                                               >
                                                   {me.hand!.length === 8 ? `حفظ المشروع (${selectedCards.length})` : `اكشف المشروع (${selectedCards.length})`}
                                               </button>
                                               <button 
                                                   onClick={() => { setProjectMode(false); setSelectedCards([]); }}
                                                   className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-full transition"
                                               >
                                                   إلغاء
                                               </button>
                                           </>
                                       ) : (
                                           <button 
                                               onClick={() => setProjectMode(true)}
                                               className="px-4 py-1.5 text-white/90 hover:text-white text-sm font-bold transition flex flex-col items-center"
                                           >
                                               تحديد مشروع
                                           </button>
                                       )}
                                  </div>
                              )}
                              
                              <div className="relative flex justify-center w-full h-[120px] md:h-[160px]">
                                   {me.hand && me.hand.map((c, i) => {
                                        if(!c) return null;
                                        
                                        const handSize = me.hand.length;
                                        const spread = 60; // Spread sweep angle in degrees
                                        const offset = i - (handSize - 1) / 2;
                                        const rotation = handSize > 1 ? offset * (spread / (handSize - 1)) : 0;
                                        const yDrop = Math.pow(Math.abs(offset), 1.5) * 5; // Parabolic arc drop
                                        const xTranslate = offset * 26; // Horizontal spacing between cards

                                        const isSelected = selectedCards.some(x => x.rank === c.rank && x.suit === c.suit);
                                        const yOffset = isSelected ? yDrop - 30 : yDrop;

                                        return (
                                            <div 
                                                key={`${i}-${c.suit}-${c.rank}`} 
                                                onClick={() => {
                                                    if (projectMode) {
                                                        if (isSelected) {
                                                            setSelectedCards(selectedCards.filter(x => !(x.rank === c.rank && x.suit === c.suit)));
                                                        } else {
                                                            if (selectedCards.length < 5) setSelectedCards([...selectedCards, c]);
                                                        }
                                                    } else if (isMyTurn && gameState.status === "playing") {
                                                        if (me.hand!.length < 8 && selectedCards.length > 0) {
                                                            socket.emit("reveal-project", selectedCards);
                                                            setSelectedCards([]);
                                                        }
                                                        socket.emit("play-card", c);
                                                    }
                                                }} 
                                                className={`absolute bottom-0 origin-bottom transition-all duration-300 cursor-pointer ${isMyTurn && gameState.status === "playing" && !projectMode ? 'hover:-translate-y-10 hover:scale-110 z-50' : 'opacity-90'} ${isSelected ? 'shadow-[0_0_20px_rgba(251,191,36,0.6)] rounded-lg' : ''}`}
                                                style={{
                                                    transform: `translateX(${xTranslate}px) translateY(${yOffset}px) rotate(${rotation}deg)`,
                                                    zIndex: isSelected ? 100 : i + 10
                                                }}
                                            >
                                                 <CardView suit={c.suit} value={c.rank} index={i} />
                                            </div>
                                        )
                                   })}
                              </div>
                         </div>
                    )}

                </div>
            </main>
        )}
    </div>
  );
}

