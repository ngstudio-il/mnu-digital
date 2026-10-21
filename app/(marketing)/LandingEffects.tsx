"use client";
import { useEffect } from "react";
import { runLanding } from "./landing-script";

export default function LandingEffects() {
  useEffect(() => {
    runLanding();
  }, []);
  return null;
}
