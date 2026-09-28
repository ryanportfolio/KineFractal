import { motion } from "framer-motion";
import { Triangle, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

export function FloatingIconsBackground() {
  const [icons, setIcons] = useState<any[]>([]);

  useEffect(() => {
    // Generate random icons
    const iconTypes = ["buy", "sell", "div", "blowoff"];
    const newIcons = Array.from({ length: 35 }).map((_, i) => {
      return {
        id: i,
        type: iconTypes[Math.floor(Math.random() * iconTypes.length)],
        x: Math.random() * 100, // percent
        y: Math.random() * 100, // percent
        scale: 0.8 + Math.random() * 0.8,
        duration: 8 + Math.random() * 15,
        delay: Math.random() * 5,
        rotation: Math.random() * 360,
      };
    });
    setIcons(newIcons);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {icons.map((icon) => (
        <FloatingIcon key={icon.id} icon={icon} />
      ))}
    </div>
  );
}

function FloatingIcon({ icon }: { icon: any }) {
  // Define the shape based on type
  const renderIcon = () => {
    switch (icon.type) {
      case "buy": // Green Triangle Up
        return (
          <Triangle 
            className="w-6 h-6 text-green-500 fill-green-500/20" 
            strokeWidth={2}
          />
        );
      case "sell": // Red Triangle Down
        return (
          <Triangle 
            className="w-6 h-6 text-red-500 fill-red-500/20 rotate-180" 
            strokeWidth={2}
          />
        );
      case "div": // Yellow Diamond
        return (
          <div className="rotate-45">
            <Square 
              className="w-4 h-4 text-yellow-400 fill-yellow-400/20" 
              strokeWidth={2}
            />
          </div>
        );
      case "blowoff": // Orange X
        return (
          <X 
            className="w-6 h-6 text-orange-500" 
            strokeWidth={3}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="absolute"
      initial={{ 
        left: `${icon.x}%`, 
        top: `${icon.y}%`, 
        opacity: 0,
        scale: 0
      }}
      animate={{ 
        y: [0, -60, 0], // Float up and down
        x: [0, 40, 0],  // Drift side to side
        opacity: [0, 0.8, 0], // Fade in and out
        scale: [icon.scale, icon.scale * 1.3, icon.scale],
        rotate: [0, icon.rotation, 0]
      }}
      transition={{
        duration: icon.duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay: icon.delay,
      }}
    >
      {renderIcon()}
    </motion.div>
  );
}