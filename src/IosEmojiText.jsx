import React, { memo } from "react";

// Regex to capture emoji characters with unicode flags
const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;

const getEmojiHex = (emojiStr) => {
  const codePoints = [];
  for (const char of emojiStr) {
    codePoints.push(char.codePointAt(0).toString(16));
  }
  return codePoints.join("-");
};

function IosEmojiText({ text, className = "", style = {} }) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  EMOJI_REGEX.lastIndex = 0;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    const emojiStr = match[0];
    const index = match.index;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    const hex = getEmojiHex(emojiStr);
    const appleCdnUrl = `https://em-content.zobj.net/source/apple/354/${hex}.png`;

    parts.push(
      <span
        key={`emoji-${index}`}
        className="ios-emoji-wrapper"
        style={{
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "middle",
          margin: "0 1px",
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
        }}
      >
        <img
          src={appleCdnUrl}
          alt={emojiStr}
          className="ios-emoji-img-inline"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            if (e.currentTarget.nextSibling) {
              e.currentTarget.nextSibling.style.display = "inline";
            }
          }}
          style={{
            width: "1.15em",
            height: "1.15em",
            objectFit: "contain",
            verticalAlign: "-0.15em",
            display: "inline-block",
          }}
        />
        <span style={{ display: "none" }}>{emojiStr}</span>
      </span>
    );

    lastIndex = index + emojiStr.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <span className={`ios-emoji-text ${className}`} style={{ fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif', ...style }}>
      {parts.map((part, idx) => (typeof part === "string" ? <React.Fragment key={idx}>{part}</React.Fragment> : part))}
    </span>
  );
}

export default memo(IosEmojiText);
