import { motion } from "framer-motion";

interface CardProps {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  value: string;
  isDraggable?: boolean;
  onDragEnd?: () => void;
  index: number;
}

const suitSymbols = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitColors = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-slate-800",
  spades: "text-slate-800",
};

export function CardView({ suit, value, isDraggable, onDragEnd, index }: CardProps) {
  return (
    <motion.div
      drag={isDraggable}
      dragSnapToOrigin
      whileDrag={{ scale: 1.1, zIndex: 50, rotate: 5 }}
      whileHover={{ y: -10 }}
      initial={{ y: 200, opacity: 0, rotateY: 180 }}
      animate={{ y: 0, opacity: 1, rotateY: 0 }}
      transition={{ 
        delay: index * 0.1, 
        duration: 0.5, 
        type: "spring", 
        stiffness: 260, 
        damping: 20 
      }}
      onDragEnd={onDragEnd}
      className="w-16 h-24 sm:w-24 sm:h-36 bg-white rounded-lg shadow-xl shadow-black/20 flex flex-col justify-between p-2 cursor-grab active:cursor-grabbing border-2 border-slate-200"
    >
      <div className={`text-lg sm:text-2xl font-bold leading-none ${suitColors[suit]}`}>
        {value}
      </div>
      <div className={`text-3xl sm:text-5xl text-center flex-1 flex items-center justify-center ${suitColors[suit]}`}>
        {suitSymbols[suit]}
      </div>
      <div className={`text-lg sm:text-2xl font-bold leading-none rotate-180 self-end ${suitColors[suit]}`}>
        {value}
      </div>
    </motion.div>
  );
}
