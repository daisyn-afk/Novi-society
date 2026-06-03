/** Launch roadmap color tokens aligned with NOVI Launch Pad mockups */

export const LAUNCH_PAD = {
  navy: "#1e2535",
  lime: "#C8E63C",
  blue: "#7B8EC8",
  blueDark: "#3a4e8c",
  orange: "#FA6F30",
  coral: "#DA6A63",
  greenDark: "#4a6b10",
  grey: "rgba(30,37,53,0.45)",
  greyLight: "rgba(30,37,53,0.12)",
  greyBorder: "rgba(30,37,53,0.1)",
  white: "rgba(255,255,255,0.9)",
  notReady: "#DA6A63",
  ready: "#4a6b10",
};

export const PHASE_THEMES = {
  foundation: {
    color: "#7B8EC8",
    textColor: "#3a4e8c",
    completedHeaderBg: "rgba(123,142,200,0.22)",
    completedBodyBg: "rgba(123,142,200,0.08)",
    completedBorder: "rgba(123,142,200,0.45)",
    completedText: "#3a4e8c",
    completedButtonBg: "#7B8EC8",
    completedButtonText: "#ffffff",
    completedButtonBorder: "rgba(123,142,200,0.6)",
  },
  activation: {
    color: "#C8E63C",
    textColor: "#4a6b10",
    completedHeaderBg: "rgba(200,230,60,0.38)",
    completedBodyBg: "rgba(200,230,60,0.14)",
    completedBorder: "rgba(200,230,60,0.55)",
    completedText: "#4a6b10",
    completedButtonBg: "#C8E63C",
    completedButtonText: "#4a6b10",
    completedButtonBorder: "rgba(74,107,16,0.25)",
  },
  growth: {
    color: "#FA6F30",
    textColor: "#b84a10",
    completedHeaderBg: "rgba(250,111,48,0.18)",
    completedBodyBg: "rgba(250,111,48,0.07)",
    completedBorder: "rgba(250,111,48,0.4)",
    completedText: "#b84a10",
    completedButtonBg: "#FA6F30",
    completedButtonText: "#ffffff",
    completedButtonBorder: "rgba(250,111,48,0.5)",
  },
  scale: {
    color: "#DA6A63",
    textColor: "#a03030",
    completedHeaderBg: "rgba(218,106,99,0.2)",
    completedBodyBg: "rgba(218,106,99,0.08)",
    completedBorder: "rgba(218,106,99,0.42)",
    completedText: "#a03030",
    completedButtonBg: "#DA6A63",
    completedButtonText: "#ffffff",
    completedButtonBorder: "rgba(218,106,99,0.5)",
  },
};

export function getPhaseTheme(phaseId) {
  return PHASE_THEMES[phaseId] || PHASE_THEMES.foundation;
}
