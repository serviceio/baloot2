import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs2 from "fs";

const firebaseConfig = JSON.parse(fs2.readFileSync("./firebase-applet-config.json", "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

import { createServer as createViteServer } from "vite";
import { GameState, Player, Card, PlayedCard, Suit } from "./src/types";

const PORT = 3000;

const DEFAULT_STATE = (): GameState => ({
  players: [],
  activePlayerIds: [],
  scores: { team1: 0, team2: 0 },
  status: "lobby",
  dealerIndex: -1,
  turnIndex: 0,
  publicCard: null,
  tableCards: [],
  tricks: [],
  bidPhase: 1,
  currentBid: null,
  showLog: false,
  revealedProjects: []
});

let globalGame = DEFAULT_STATE();
let deck: Card[] = [];
let passCount = 0;
let evaluateTimer: NodeJS.Timeout | null = null;

function createDeck(): Card[] {
    const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
    const ranks: ("7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A")[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
    const newDeck: Card[] = [];
    for(let s of suits) for(let r of ranks) newDeck.push({suit: s, rank: r});
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

function evaluateTrick(trickCards: PlayedCard[], type: "sun" | "hukum" | "ashkal", hSuit?: Suit): PlayedCard {
    const sunRanks: Record<string, number> = { "7": 1, "8": 2, "9": 3, "J": 4, "Q": 5, "K": 6, "10": 7, "A": 8 };
    const hokRanks: Record<string, number> = { "7": 1, "8": 2, "Q": 3, "K": 4, "10": 5, "A": 6, "9": 7, "J": 8 };
    const isHukum = type === "hukum";

    let ledSuit = trickCards[0].card.suit;
    let winner = trickCards[0];

    const getVal = (c: Card) => {
        if (isHukum && c.suit === hSuit) return hokRanks[c.rank] + 100;
        if (c.suit === ledSuit) return sunRanks[c.rank];
        return -1;
    }

    let maxVal = getVal(winner.card);
    
    for (let i = 1; i < trickCards.length; i++) {
         let v = getVal(trickCards[i].card);
         if (v > maxVal) {
             maxVal = v;
             winner = trickCards[i];
         }
    }
    return winner;
}

function calculateHandScore() {
    if (!globalGame.currentBid) return;
    const isSun = globalGame.currentBid.type === "sun" || globalGame.currentBid.type === "ashkal";
    const bidSuit = globalGame.currentBid.suit;
    
    const points = {
        sun: { "A": 11, "10": 10, "K": 4, "Q": 3, "J": 2, "9": 0, "8": 0, "7": 0 },
        hukum: {
            trump: { "J": 20, "9": 14, "A": 11, "10": 10, "K": 4, "Q": 3, "8": 0, "7": 0 },
            normal: { "A": 11, "10": 10, "K": 4, "Q": 3, "J": 2, "9": 0, "8": 0, "7": 0 }
        }
    };

    let t1Points = 0;
    let t2Points = 0;

    globalGame.tricks.forEach((trick, trickIdx) => {
        const winnerP = globalGame.players.find(p => p.id === trick.winnerId);
        const wTeam = winnerP?.team;
        if (!wTeam) return;

        let trickScore = 0;
        trick.cards.forEach(c => {
            if (isSun) {
                trickScore += points.sun[c.card.rank];
            } else {
                if (c.card.suit === bidSuit) trickScore += points.hukum.trump[c.card.rank];
                else trickScore += points.hukum.normal[c.card.rank];
            }
        });

        if (trickIdx === 7) trickScore += 10; // Last trick bonus

        if (wTeam === 1) t1Points += trickScore;
        else if (wTeam === 2) t2Points += trickScore;
    });

    let t1Final = Math.round(t1Points / 10);
    let t2Final = Math.round(t2Points / 10);

    if (isSun) {
       t1Final *= 2;
       t2Final *= 2;
    }

    const buyerTeam = globalGame.players.find(p => p.id === globalGame.currentBid!.buyerId)?.team;
    
    // Check for "Khasara" (buyer team got fewer points)
    if (buyerTeam === 1 && t1Points < t2Points) {
         t2Final = isSun ? 26 : 16;
         t1Final = 0;
    } else if (buyerTeam === 2 && t2Points < t1Points) {
         t1Final = isSun ? 26 : 16;
         t2Final = 0;
    }

    globalGame.scores.team1 += t1Final;
    globalGame.scores.team2 += t2Final;
}

function sortHand(hand: Card[]) {
    const suitOrder: Record<string, number> = {"spades": 1, "hearts": 2, "clubs": 3, "diamonds": 4};
    const rankOrder: Record<string, number> = {"A": 1, "K": 2, "Q": 3, "J": 4, "10": 5, "9": 6, "8": 7, "7": 8};
    hand.sort((a,b) => {
        if(suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
        return rankOrder[a.rank] - rankOrder[b.rank];
    });
}

function startPlayingPhase() {
    const buyerIdx = globalGame.activePlayerIds.indexOf(globalGame.currentBid!.buyerId);
    const partnerIdx = (buyerIdx + 2) % 4;

    globalGame.activePlayerIds.forEach((id, idx) => {
        const p = globalGame.players.find(x => x.id === id);
        if (!p) return;
        
        if (globalGame.currentBid!.type === "ashkal" && idx === partnerIdx) {
            p.hand.push(globalGame.publicCard!);
            p.hand.push(...deck.splice(0, 2));
        } else if (globalGame.currentBid!.type !== "ashkal" && idx === buyerIdx) {
            p.hand.push(globalGame.publicCard!);
            p.hand.push(...deck.splice(0, 2));
        } else {
            p.hand.push(...deck.splice(0, 3));
        }
        sortHand(p.hand);
    });
    globalGame.publicCard = null;
    globalGame.status = "playing";
    globalGame.turnIndex = (globalGame.dealerIndex + 1) % 4;
}

function getSafeGame(socketId: string) {
    const safeGame = JSON.parse(JSON.stringify(globalGame)) as GameState;
    if (safeGame.status === "playing" || safeGame.status === "bidding") {
        safeGame.players.forEach(p => {
             if (p.id !== socketId) {
                 p.hand = p.hand.map(() => null as any); // hide cards
             }
        });
    }
    return safeGame;
}

function performDeal(keepSameDealer: boolean = false) {
      const t1 = globalGame.players.filter(p => p.team === 1);
      const t2 = globalGame.players.filter(p => p.team === 2);
      if (t1.length < 2 || t2.length < 2) return;

      Object.assign(globalGame, {
          status: "bidding", tableCards: [], tricks: [], bidPhase: 1, currentBid: null, showLog: false, revealedProjects: []
      });
      passCount = 0;
      deck = createDeck();
      
      // Order: T1, T2, T1, T2
      globalGame.activePlayerIds = [t1[0].id, t2[0].id, t1[1].id, t2[1].id];
      
      if (globalGame.dealerIndex === -1) {
          globalGame.dealerIndex = 0; 
      } else if (!keepSameDealer) {
          globalGame.dealerIndex = (globalGame.dealerIndex + 1) % 4; // Rotate dealer
      }
      
      globalGame.turnIndex = (globalGame.dealerIndex + 1) % 4; // Bid starts to the right (assuming counter-clockwise mapped to next array index)
      globalGame.publicCard = deck.splice(0, 1)[0];

      globalGame.players.forEach(p => p.hand = []);
      globalGame.activePlayerIds.forEach(id => {
         const p = globalGame.players.find(x => x.id === id);
         if(p) {
             p.hand.push(...deck.splice(0, 5));
             sortHand(p.hand);
         }
      });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  const broadcast = () => {
      io.sockets.sockets.forEach((s) => {
           s.emit("game-state", getSafeGame(s.id));
      });
      setDoc(doc(db, "games", "main"), globalGame).catch(console.error);
  }

  io.on("connection", (socket) => {
    socket.on("login", ({ name }) => {
      const isHost = globalGame.players.length === 0;
      if (globalGame.players.length < 10) {
        globalGame.players.push({ id: socket.id, name, team: null, isHost, hand: [] });
      }
      broadcast();
    });

    socket.on("join-team", (team: 1 | 2) => {
      const p = globalGame.players.find(x => x.id === socket.id);
      if (p && globalGame.status === "lobby") p.team = team;
      broadcast();
    });

    socket.on("start-game", () => {
      const me = globalGame.players.find(x => x.id === socket.id);
      if (!me?.isHost) return;
      performDeal(false);
      broadcast();
    });

    socket.on("kashoo", () => {
        if(globalGame.status !== "bidding") return;
        const p = globalGame.players.find(x => x.id === socket.id);
        if(!p) return;

        // Check if hand contains ONLY 7s, 8s, 9s
        const isValid = p.hand.every(c => c.rank === "7" || c.rank === "8" || c.rank === "9");
        if(isValid) {
            const anyoneBid = !!globalGame.currentBid;
            performDeal(!anyoneBid); // If anyone bid, move dealer. If no one, keep same.
            broadcast();
        }
    });

    socket.on("bid", (data: { action: "sun" | "hukum" | "ashkal" | "pass", suit?: Suit }) => {
        if(globalGame.status !== "bidding") return;
        const pIndex = globalGame.activePlayerIds.indexOf(socket.id);
        if(pIndex !== globalGame.turnIndex) return;

        if (data.action === "pass") {
            passCount++;
            if (globalGame.currentBid) {
                // Someone has a standing bid, we are waiting for others to pass.
                if (passCount === 3) {
                    startPlayingPhase();
                } else {
                    globalGame.turnIndex = (globalGame.turnIndex + 1) % 4;
                }
            } else {
                // No bid yet
                if (passCount === 4) {
                    if (globalGame.bidPhase === 1) {
                        globalGame.bidPhase = 2;
                        passCount = 0;
                        globalGame.turnIndex = (globalGame.dealerIndex + 1) % 4;
                    } else {
                        // Everyone passed twice -> restart deal
                        globalGame.status = "lobby";
                    }
                } else {
                    globalGame.turnIndex = (globalGame.turnIndex + 1) % 4;
                }
            }
        } else {
             if (data.action === "sun") {
                  const buyingSuit = globalGame.publicCard!.suit;
                  globalGame.currentBid = { type: "sun", suit: buyingSuit, buyerId: socket.id };
                  startPlayingPhase(); // Sun immediately ends bidding.
             } else {
                  // "hukum" or "ashkal"
                  const buyingSuit = globalGame.bidPhase === 1 ? globalGame.publicCard!.suit : (data.suit || globalGame.publicCard!.suit);
                  globalGame.currentBid = { type: data.action, suit: buyingSuit, buyerId: socket.id };
                  passCount = 0; // reset pass count for others to get a chance
                  globalGame.turnIndex = (globalGame.turnIndex + 1) % 4;
             }
        }
        broadcast();
    });

    socket.on("play-card", (cardInfo: Card) => {
        if(globalGame.status !== "playing" || globalGame.turnIndex === -1) return;
        const pIndex = globalGame.activePlayerIds.indexOf(socket.id);
        if(pIndex !== globalGame.turnIndex) return;

        const p = globalGame.players.find(x => x.id === socket.id!);
        if(!p) return;

        const cIdx = p.hand.findIndex(c => c.suit === cardInfo.suit && c.rank === cardInfo.rank);
        if (cIdx === -1) return;

        const card = p.hand.splice(cIdx, 1)[0];
        globalGame.tableCards.push({ playerId: socket.id, card });

        if (globalGame.tableCards.length < 4) {
             globalGame.turnIndex = (globalGame.turnIndex + 1) % 4;
             broadcast();
        } else {
             globalGame.turnIndex = -1; // Freeze for display
             broadcast();

             evaluateTimer = setTimeout(() => {
                 const winner = evaluateTrick(globalGame.tableCards, globalGame.currentBid!.type, globalGame.currentBid!.suit);
                 globalGame.tricks.push({ cards: [...globalGame.tableCards], winnerId: winner.playerId });
                 globalGame.tableCards = [];
                 globalGame.turnIndex = globalGame.activePlayerIds.indexOf(winner.playerId);
                 
                 const anyActive = globalGame.players.find(x => x.id === globalGame.activePlayerIds[0]);
                 if(anyActive && anyActive.hand.length === 0) {
                     globalGame.status = "lobby"; 
                     globalGame.showLog = true; // Auto open tricks log for manual counting
                 }
                 broadcast();
             }, 2500);
        }
    });

    socket.on("update-score", ({ team1, team2 }) => {
        const me = globalGame.players.find(x => x.id === socket.id);
        if (me?.isHost) {
            globalGame.scores.team1 += team1;
            globalGame.scores.team2 += team2;
            broadcast();
        }
    });

    socket.on("toggle-log", () => {
         const p = globalGame.players.find(x => x.id === socket.id);
         if(p && p.isHost) {
              globalGame.showLog = !globalGame.showLog;
              if (globalGame.showLog && (globalGame.status === "playing" || globalGame.status === "bidding")) {
                  globalGame.status = "lobby"; // End the round but NOT the game scores
              }
              broadcast();
         }
    });

    socket.on("reveal-project", (cards: Card[]) => {
         if (globalGame.status === "playing") {
              globalGame.revealedProjects.push({ playerId: socket.id, cards });
              broadcast();
              setTimeout(() => {
                  globalGame.revealedProjects = globalGame.revealedProjects.filter(p => !(p.playerId === socket.id && p.cards === cards));
                  broadcast();
              }, 8000);
         }
    });

    socket.on("reset-game", () => {
         const p = globalGame.players.find(x => x.id === socket.id);
         if (p && p.isHost) {
             globalGame.scores = { team1: 0, team2: 0 };
             globalGame.tricks = [];
             globalGame.status = "lobby";
             broadcast();
         }
    });

    // Voice WebRTC
    socket.on("voice-ready", () => socket.broadcast.emit("user-voice-ready", socket.id));
    socket.on("voice-offer", (data) => socket.to(data.to).emit("voice-offer", { from: socket.id, offer: data.offer }));
    socket.on("voice-answer", (data) => socket.to(data.to).emit("voice-answer", { from: socket.id, answer: data.answer }));
    socket.on("voice-ice-candidate", (data) => socket.to(data.to).emit("voice-ice-candidate", { from: socket.id, candidate: data.candidate }));

    socket.on("disconnect", () => {
        const playerIndex = globalGame.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const wasHost = globalGame.players[playerIndex].isHost;
          globalGame.players.splice(playerIndex, 1);
          if (wasHost && globalGame.players.length > 0) {
            globalGame.players[0].isHost = true;
          }
          if (globalGame.players.length === 0) {
            globalGame = DEFAULT_STATE();
          } else {
            broadcast();
          }
        }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  server.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
