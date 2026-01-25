"use client";

import { useState, useEffect } from "react";

interface AnimatedTextProps {
  className?: string;
}

export function AnimatedText({ className = "" }: AnimatedTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);
  const [lastTypedIndex, setLastTypedIndex] = useState(-1);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Use deterministic suggestions array initially to avoid hydration mismatch
  const baseSuggestions = [
    "create a stunning portfolio!",
    "build a tic tac toe game!",
    "design a website for my restaurant!",
    "make a sleek landing page!",
    "build an e-commerce store!",
    "create a personal blog!",
    "develop a modern dashboard!",
    "design a company website!",
    "build a todo app!",
    "create an online gallery!",
    "make a contact form!",
    "build a weather app!",
  ];

  const [suggestions, setSuggestions] = useState(baseSuggestions);

  // Randomize on client-side only to avoid hydration mismatch
  useEffect(() => {
    const shuffled = [...baseSuggestions];
    // Fisher-Yates shuffle algorithm
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setSuggestions(shuffled);
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    if (animationComplete) return;

    let timeout: NodeJS.Timeout;

    const typeText = () => {
      const currentSuggestion = suggestions[currentSuggestionIndex];

      if (isTyping) {
        if (displayText.length < currentSuggestion.length) {
          setDisplayText(currentSuggestion.slice(0, displayText.length + 1));
          setLastTypedIndex(displayText.length);
          timeout = setTimeout(typeText, 80);
        } else {
          // Finished typing, wait then start erasing
          setLastTypedIndex(-1);
          timeout = setTimeout(() => {
            setIsTyping(false);
          }, 2000);
        }
      }
    };

    timeout = setTimeout(typeText, 100);
    return () => clearTimeout(timeout);
  }, [
    displayText,
    currentSuggestionIndex,
    isTyping,
    suggestions,
    animationComplete,
  ]);

  // Cursor blinking effect
  useEffect(() => {
    if (animationComplete) {
      setShowCursor(false);
      return;
    }

    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 600);

    return () => clearInterval(cursorInterval);
  }, [animationComplete]);

  useEffect(() => {
    if (lastTypedIndex >= 0) {
      const timeout = setTimeout(() => {
        setLastTypedIndex(-1);
      }, 400);

      return () => clearTimeout(timeout);
    }
  }, [lastTypedIndex]);

  return (
    <p className={`font-mono ${className}`}>
      Hey buildflow,&nbsp;
      {displayText.split("").map((char, index) => (
        <span
          key={`${currentSuggestionIndex}-${index}`}
          className={`transition-colors duration-300 ${
            index === lastTypedIndex ? "text-neutral-100" : ""
          }`}
        >
          {char}
        </span>
      ))}
      <span
        className={`${
          showCursor ? "opacity-100" : "opacity-0"
        } transition-opacity`}
      >
        |
      </span>
    </p>
  );
}
