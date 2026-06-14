export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
    suit: Suit;
    rank: Rank;
}

export interface PlayedCard {
    playerId: string;
    card: Card;
}

export interface Player {
  id: string;
  name: string;
  team: 1 | 2 | null;
  isHost: boolean;
  hand: Card[];
}

export interface GameState {
  players: Player[];
  activePlayerIds: string[];
  scores: { team1: number; team2: number };
  status: "lobby" | "bidding" | "playing" | "finished";
  dealerIndex: number;
  turnIndex: number;
  publicCard: Card | null;
  tableCards: PlayedCard[];
  tricks: { cards: PlayedCard[], winnerId: string }[];
  bidPhase: number;
  currentBid: { type: "sun" | "hukum" | "ashkal", suit?: Suit, buyerId: string } | null;
  showLog: boolean;
  revealedProjects: { playerId: string, cards: Card[] }[];
}
