import { useRef, useEffect, useCallback, memo } from 'react';
import './LyricsRenderer.css';

/**
 * Apple Music-style lyrics — TRUE 60fps word-by-word reveal.
 *
 * Architecture:
 * - RAF loop reads audio.currentTime DIRECTLY (not from React state)
 * - This bypasses onTimeUpdate's 4Hz bottleneck
 * - All word progress computed in RAF, written to DOM via CSS custom property
 * - Zero React re-renders during playback
 */

function LyricsRenderer({
  lyrics = [],
  fontSize = 'md',
  textStyle = 'normal',
  showTranslation = false,
  onSeek,
  isLoading = false,
  emptyMessage = 'Текст песни не найден',
  onFindLyrics,
  getActiveAudio, // <-- NEW: direct audio element access
}) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const wordElsRef = useRef({}); // { lineIdx: [wordEl0, wordEl1, ...] }
  const wordDataRef = useRef({}); // { lineIdx: [{text, start, end}, ...] }
  const isUserScrolling = useRef(false);
  const scrollTimer = useRef(null);
  const lastActiveIdx = useRef(-1);
  const rafRef = useRef(null);
  const activeIdxRef = useRef(-1);
  const lyricsRef = useRef(lyrics);

  // Keep lyricsRef current
  useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  const hasSync = lyrics.some(l => l.time != null);

  // Split line text into timed words (pure function, no deps)
  const computeWordData = (line) => {
    if (!line || line.time == null) return null;
    const text = line.text || '';
    const lineStart = line.time;
    const lineDuration = line.duration || 3000;

    if (line.syllabus && line.syllabus.length > 0) {
      const words = [];
      let currentWord = '';
      let wordStartTime = line.syllabus[0].time || lineStart;

      for (let i = 0; i < line.syllabus.length; i++) {
        const syl = line.syllabus[i];
        currentWord += syl.text;
        const isSpace = syl.text === ' ';
        const isLast = i === line.syllabus.length - 1;
        const nextIsSpace = isLast || line.syllabus[i + 1]?.text === ' ';

        if (isSpace || isLast || nextIsSpace) {
          words.push({
            text: currentWord,
            start: wordStartTime,
            end: syl.time + (syl.duration || 200),
          });
          currentWord = '';
          if (!isLast) wordStartTime = line.syllabus[i + 1]?.time || lineStart;
        }
      }
      return words.length > 0 ? words : null;
    }

    // Fallback: distribute timing evenly
    const parts = text.split(/(\s+)/);
    const wordCount = parts.filter(w => w.trim()).length;
    if (wordCount === 0) return null;

    const msPerWord = lineDuration / wordCount;
    let time = lineStart;
    const result = [];
    for (const w of parts) {
      if (w.trim()) {
        result.push({ text: w, start: time, end: time + msPerWord });
        time += msPerWord;
      } else if (result.length > 0) {
        result[result.length - 1].text += w;
      }
    }
    return result;
  };

  // Binary search for active line — O(log n)
  const findActiveLine = (currentMs) => {
    const lyr = lyricsRef.current;
    if (!lyr || lyr.length === 0) return -1;
    let lo = 0, hi = lyr.length - 1, result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = lyr[mid].time;
      if (t == null) { lo = mid + 1; continue; }
      if (currentMs >= t) { result = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return result;
  };

  // Easing: smooth ease-out
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // ===== MAIN RAF LOOP — reads audio.currentTime directly =====
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const audio = getActiveAudio ? getActiveAudio() : null;
      const nowMs = audio ? audio.currentTime * 1000 : 0;

      // 1. Find active line
      const idx = findActiveLine(nowMs);

      // 2. Update word --p for active line (direct DOM, no React)
      const words = wordElsRef.current[idx];
      const data = wordDataRef.current[idx];
      if (words && data) {
        for (let wi = 0; wi < words.length; wi++) {
          if (wi >= data.length) break;
          const w = data[wi];
          let p;
          if (nowMs < w.start) {
            p = 0;
          } else {
            const dur = Math.max(1, w.end - w.start);
            const t = Math.min(1, (nowMs - w.start) / dur);
            p = easeOut(t);
          }
          words[wi].style.setProperty('--p', p.toFixed(4));
        }
      }

      // 3. Update line styles (opacity, blur, scale) via direct DOM
      const lineEls = lineRefs.current;
      const lyr = lyricsRef.current;
      for (let li = 0; li < lyr.length; li++) {
        const el = lineEls[li];
        if (!el) continue;
        const line = lyr[li];
        if (line.time == null) continue;

        const isActive = li === idx;
        const isPast = li < idx;
        const dist = Math.abs(li - idx);

        let opacity, scale, ty;
        if (isActive) {
          opacity = 1; scale = 1; ty = 0;
        } else if (isPast) {
          opacity = 0.2; scale = 0.98; ty = 2;
        } else {
          opacity = Math.max(0.15, 0.7 - dist * 0.12);
          scale = Math.max(0.97, 1 - dist * 0.01);
          ty = Math.min(dist * 3, 10);
        }

        el.style.opacity = opacity;
        el.style.transform = `scale(${scale}) translateY(${ty}px)`;
        el.style.filter = 'none';
      }

      // 4. Auto-scroll to active line
      if (idx >= 0 && idx !== lastActiveIdx.current && !isUserScrolling.current) {
        lastActiveIdx.current = idx;
        activeIdxRef.current = idx;
        const el = lineEls[idx];
        if (el && container) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const offset = elRect.top - containerRect.top - containerRect.height * 0.35;
          container.scrollBy({ top: offset, behavior: 'smooth' });
        }
      } else {
        activeIdxRef.current = idx;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [getActiveAudio]);

  // Detect user scroll to pause auto-scroll
  const handleScroll = useCallback(() => {
    isUserScrolling.current = true;
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => { isUserScrolling.current = false; }, 4000);
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    c.addEventListener('scroll', handleScroll, { passive: true });
    return () => c.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Click to seek
  const handleLineClick = useCallback((line) => {
    if (line.time != null && onSeek) {
      onSeek(line.time / 1000);
      isUserScrolling.current = false;
    }
  }, [onSeek]);

  if (isLoading) {
    return (
      <div className="lr-loading">
        <div className="lr-loading__dots">
          <div className="lr-loading__dot" />
          <div className="lr-loading__dot" />
          <div className="lr-loading__dot" />
        </div>
        <div style={{ fontSize: 13 }}>Поиск текста...</div>
      </div>
    );
  }

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="lr-empty">
        <div className="lr-empty__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="lr-empty__text">{emptyMessage}</div>
        <div className="lr-empty__sub">Текст пока недоступен</div>
        {onFindLyrics && (
          <button className="lr-empty__btn" onClick={onFindLyrics}>Найти текст</button>
        )}
      </div>
    );
  }

  const containerClass = `lyrics-renderer lr-font-${fontSize} lr-style-${textStyle}`;

  return (
    <div ref={containerRef} className={containerClass}>
      {lyrics.map((line, idx) => {
        const isPlain = line.time == null;

        const lineClass = [
          'lr-line',
          isPlain && 'lr-line--plain',
        ].filter(Boolean).join(' ');

        // Only compute word data once, cache in ref
        let wordSpans = null;
        if (!isPlain && hasSync) {
          const wd = computeWordData(line);
          if (wd) {
            wordDataRef.current[idx] = wd;
            wordSpans = wd.map((w, wi) => (
              <span key={wi} className="lr-word" data-wi={wi}>
                {w.text}
              </span>
            ));
          }
        }

        return (
          <div
            key={idx}
            ref={el => {
              lineRefs.current[idx] = el;
              if (wordSpans) {
                // We need to collect word elements after render
                // Use a post-render effect via ref callback on the lr-main div
              }
            }}
            className={lineClass}
            onClick={() => handleLineClick(line)}
          >
            <div
              className="lr-main"
              ref={el => {
                if (el && !isPlain && hasSync) {
                  const words = el.querySelectorAll('.lr-word');
                  if (words.length > 0) {
                    wordElsRef.current[idx] = Array.from(words);
                  }
                }
              }}
            >
              {wordSpans || (line.text || '\u00a0')}
            </div>
            {showTranslation && line.translation && (
              <div className="lr-translation">{line.translation}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(LyricsRenderer, (prev, next) => {
  return prev.lyrics === next.lyrics
    && prev.fontSize === next.fontSize
    && prev.textStyle === next.textStyle
    && prev.showTranslation === next.showTranslation
    && prev.isLoading === next.isLoading
    && prev.getActiveAudio === next.getActiveAudio;
});
