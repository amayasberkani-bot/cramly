import React from "react";

const poses = new Set(["neutral", "thinking", "celebrating", "writing-on-board", "sleepy", "wink-thumbs-up", "reading", "shrug"]);

export function Zuzu({ pose = "neutral", streak = 0, className = "", alt = "Zuzu" }) {
  const safePose = poses.has(pose) ? pose : "neutral";
  return <img
    className={`zuzu ${className}`.trim()}
    src="/brand/zuzu-clean.svg"
    alt={alt}
    data-pose={safePose}
    data-streak={Math.max(0, Number(streak) || 0)}
    width="96"
    height="96"
    loading="lazy"
  />;
}
